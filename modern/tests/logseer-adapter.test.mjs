import { afterEach, describe, expect, it } from 'vitest'
import { buildQuery, createLogseerAdapter } from '../test-support/logseer-adapter/adapter.js'

const servers = []

async function startAdapter(fetchImpl) {
  const server = createLogseerAdapter({ fetchImpl })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  servers.push(server)
  const { port } = server.address()
  return `http://127.0.0.1:${port}`
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise((resolve) => {
          server.close(resolve)
        }),
    ),
  )
})

describe('Logseer test adapter', () => {
  it('translates range, filters, query, sort and histogram into an Elasticsearch query', () => {
    const body = buildQuery({
      range: { timestamp: { gte: 'now-1h', lte: 'now' } },
      filters: [{ key: 'pod', value: 'web-0' }],
      query: 'upstream timeout',
      size: 20,
      from: 10,
      sort: [{ timestamp: 'desc' }],
      aggs: { interval: '5m' },
    })
    expect(body.query.bool.filter[0]).toEqual({ range: { timestamp: { gte: 'now-1h', lte: 'now' } } })
    expect(body.query.bool.filter[1]).toEqual({ match: { pod_name: 'web-0' } })
    expect(body.query.bool.must[0]).toEqual({
      query_string: { query: 'upstream timeout', default_field: 'message', lenient: true },
    })
    expect(body.size).toBe(20)
    expect(body.from).toBe(10)
    expect(body.sort).toEqual([{ timestamp: 'desc' }])
    expect(body.aggs.histogram.date_histogram).toMatchObject({ field: 'timestamp', fixed_interval: '5m' })
  })

  it('serves the available fields and label selector keys the console expects', async () => {
    const base = await startAdapter(async () => jsonResponse({}))
    const fields = await (await fetch(`${base}/api/v1/logseer/extends/elasticsearch/availableFields`)).json()
    const labels = await (await fetch(`${base}/api/v1/logseer/extends/labelSelectorKey`)).json()
    expect(fields.availableFields).toContain('pod_name')
    expect(fields.availableFields).toHaveLength(8)
    expect(labels).toEqual(['app', 'component', 'tier'])
  })

  it('forwards a search to Elasticsearch and returns its hits', async () => {
    let sent
    const base = await startAdapter(async (url, init) => {
      sent = { url, body: JSON.parse(init.body) }
      return jsonResponse({ hits: { hits: [{ _id: '1', _source: { message: 'upstream timeout' } }] } })
    })
    const response = await fetch(`${base}/api/v1/logseer/extends/elasticsearch/_search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'upstream timeout', filters: [{ key: 'pod', value: 'web-0' }] }),
    })
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(sent.url).toContain('/app-logs/_search')
    expect(sent.body.query.bool.filter[0]).toEqual({ match: { pod_name: 'web-0' } })
    expect(body.hits.hits[0]._source.message).toBe('upstream timeout')
  })

  it('lists and creates LogConfigs through the v2 routes', async () => {
    const calls = []
    const base = await startAdapter(async (url, init) => {
      calls.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : undefined })
      if (url.endsWith('/_search')) {
        return jsonResponse({ hits: { hits: [{ _id: 'shop-default', _source: { name: 'shop-default', cluster: 'pivot' } }] } })
      }
      return jsonResponse({ result: 'created' })
    })
    const listed = await (await fetch(`${base}/api/v2/logseer/extends/clusters/pivot/namespaces/shop/logconfigs`)).json()
    expect(listed.total).toBe(1)
    expect(listed.items[0].name).toBe('shop-default')

    const created = await fetch(`${base}/api/v2/logseer/extends/clusters/pivot/namespaces/shop/logconfigs/shop-default`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: ['message'] }),
    })
    expect(created.status).toBe(200)
    const put = calls.find((call) => call.method === 'PUT')
    expect(put.url).toContain('/logconfigs/_doc/shop-default?refresh=true')
    expect(put.body).toMatchObject({ name: 'shop-default', cluster: 'pivot', namespace: 'shop' })
  })

  it('returns a structured 404 for unknown routes', async () => {
    const base = await startAdapter(async () => jsonResponse({}))
    const response = await fetch(`${base}/unknown`)
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ message: 'not found' })
  })
})
