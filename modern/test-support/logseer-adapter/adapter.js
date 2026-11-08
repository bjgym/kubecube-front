// Test-only Logseer-compatible adapter backed by Elasticsearch.
//
// KubeCube's `hub.c.163.com/qingzhou/logseer` image is not publicly reachable and
// has no public source repository. This adapter implements only the endpoints the
// console's Live suite needs (`availableFields`, `suggestions`, `_search`,
// `labelSelectorKey` and LogConfig CRUD), so log search and LogConfig flows can be
// verified against a real Elasticsearch without pretending to be the production
// Logseer service. It is not shipped in the console image and is not a supported
// production component.

import http from 'node:http'

export function buildQuery(body) {
  const filters = []
  const must = []
  if (body.range?.timestamp) {
    filters.push({ range: { timestamp: { gte: body.range.timestamp.gte, lte: body.range.timestamp.lte } } })
  }
  for (const filter of body.filters || []) {
    if (filter && filter.key && filter.value !== undefined && filter.value !== '') {
      const field = filter.key === 'pod' ? 'pod_name' : filter.key
      filters.push({ match: { [field]: filter.value } })
    }
  }
  if (body.query) {
    must.push({ query_string: { query: body.query, default_field: 'message', lenient: true } })
  }
  const query = { bool: { filter: filters, must: must.length ? must : [{ match_all: {} }] } }
  const result = { query, size: body.size || 50, from: body.from || 0 }
  if (body.sort) result.sort = body.sort
  if (body.aggs?.interval) {
    result.aggs = {
      histogram: {
        date_histogram: { field: 'timestamp', fixed_interval: body.aggs.interval, min_doc_count: 0 },
      },
    }
  }
  return result
}

export function createLogseerAdapter({
  esUrl = process.env.ES_URL || 'http://127.0.0.1:9200',
  logIndex = process.env.LOG_INDEX || 'app-logs',
  configIndex = process.env.CONFIG_INDEX || 'logconfigs',
  fetchImpl = globalThis.fetch,
} = {}) {
  async function es(path, method = 'GET', body) {
    const response = await fetchImpl(`${esUrl}${path.startsWith('/') ? '' : '/'}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    const text = await response.text()
    let data
    try {
      data = JSON.parse(text)
    } catch {
      data = { raw: text }
    }
    return { status: response.status, data }
  }

  function send(response, status, data) {
    response.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    })
    response.end(JSON.stringify(data))
  }

  function readBody(request) {
    return new Promise((resolve) => {
      let raw = ''
      request.on('data', (chunk) => (raw += chunk))
      request.on('end', () => {
        try {
          resolve(raw ? JSON.parse(raw) : {})
        } catch {
          resolve({})
        }
      })
    })
  }

  async function listConfigs(cluster, namespace) {
    const result = await es(`${configIndex}/_search`, 'POST', {
      size: 1000,
      query: {
        bool: {
          filter: [...(cluster ? [{ match: { cluster } }] : []), ...(namespace ? [{ match: { namespace } }] : [])],
        },
      },
    })
    const hits = result.data.hits?.hits || []
    return hits.map((hit) => ({ ...hit._source, name: hit._id }))
  }

  return http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1')
    const path = url.pathname
    try {
      if (path === '/api/v1/logseer/extends/elasticsearch/availableFields') {
        return send(response, 200, {
          availableFields: ['message', 'timestamp', 'cluster_name', 'namespace', 'pod_name', 'container_name', 'logconfig', 'level'],
        })
      }
      if (path === '/api/v1/logseer/extends/elasticsearch/suggestions') {
        const body = await readBody(request)
        const field = body.field || 'message'
        const result = await es(`${logIndex}/_search`, 'POST', {
          size: 0,
          aggs: { values: { terms: { field, size: 20 } } },
        })
        const buckets = result.data.aggregations?.values?.buckets || []
        return send(response, 200, { suggestions: buckets.map((bucket) => String(bucket.key)) })
      }
      if (path === '/api/v1/logseer/extends/elasticsearch/_seed') {
        const body = await readBody(request)
        for (const document of body.docs || []) {
          await es(`${logIndex}/_doc?refresh=true`, 'POST', document)
        }
        return send(response, 200, { seeded: (body.docs || []).length })
      }
      if (path === '/api/v1/logseer/extends/elasticsearch/_search') {
        const body = await readBody(request)
        const result = await es(`${logIndex}/_search`, 'POST', buildQuery(body))
        return send(response, result.status === 200 ? 200 : result.status, result.data)
      }
      if (path === '/api/v1/logseer/extends/labelSelectorKey') {
        return send(response, 200, ['app', 'component', 'tier'])
      }
      const configMatch = path.match(/^\/api\/v2\/logseer\/extends\/clusters\/([^/]+)\/namespaces\/([^/]+)\/logconfigs(?:\/([^/]+))?$/)
      if (configMatch) {
        const cluster = decodeURIComponent(configMatch[1])
        const namespace = decodeURIComponent(configMatch[2])
        const name = configMatch[3] ? decodeURIComponent(configMatch[3]) : ''
        if (request.method === 'GET' && name) {
          const result = await es(`${configIndex}/_doc/${encodeURIComponent(name)}`)
          return send(response, result.status === 200 ? 200 : 404, result.data)
        }
        if (request.method === 'GET') {
          const items = await listConfigs(cluster, namespace)
          return send(response, 200, { items, total: items.length })
        }
        if (request.method === 'POST' || request.method === 'PUT') {
          const body = await readBody(request)
          const id = name || body.name || `logconfig-${Date.now()}`
          await es(`${configIndex}/_doc/${encodeURIComponent(id)}?refresh=true`, 'PUT', {
            ...body,
            name: id,
            cluster,
            namespace,
          })
          return send(response, 200, { ...body, name: id, cluster, namespace })
        }
        if (request.method === 'DELETE') {
          await es(`${configIndex}/_doc/${encodeURIComponent(name)}?refresh=true`, 'DELETE')
          return send(response, 200, {})
        }
      }
      if (path === '/api/v2/logseer/extends/logconfigs') {
        const cluster = url.searchParams.get('cluster') || ''
        const namespace = url.searchParams.get('namespace') || ''
        const items = await listConfigs(cluster, namespace)
        return send(response, 200, { items, total: items.length })
      }
      send(response, 404, { message: 'not found' })
    } catch (error) {
      send(response, 500, { message: String(error) })
    }
  })
}
