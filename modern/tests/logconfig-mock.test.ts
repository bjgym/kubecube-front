import { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { describe, expect, it } from 'vitest'
import { mockAdapter } from '@/api/mock/adapter'
import type { LogConfigDto } from '@/api/logconfig'

async function call<T = unknown>(
  method: string,
  url: string,
  options: { params?: Record<string, unknown>; data?: unknown } = {},
): Promise<T> {
  const config: InternalAxiosRequestConfig = {
    ...options,
    method,
    url,
    headers: new AxiosHeaders(),
  }
  const response = await mockAdapter(config)
  return response.data as T
}

describe('Logseer mock contract', () => {
  it('persists legacy DTO CRUD across list/get/replace/delete requests', async () => {
    const cluster = 'contract-cluster'
    const namespace = 'contract-namespace'
    const name = 'contract-task'
    const collection = `/api/v2/logseer/extends/clusters/${cluster}/namespaces/${namespace}/logconfigs`
    const item = `${collection}/${name}`
    const created = await call<LogConfigDto>('POST', collection, {
      data: {
        name,
        labelSelector: { app: 'contract' },
        inputs: [{ paths: ['stdout'], multiline: { active: true, pattern: '^\\[', match: 'after' } }],
        removeOnReplace: true,
      },
    })
    expect(created.name).toBe(name)
    expect(created.cluster).toBe(cluster)
    expect(created.namespace).toBe(namespace)
    expect(created).not.toHaveProperty('metadata')

    const list = await call<{ items: LogConfigDto[]; total: number }>('GET', '/api/v2/logseer/extends/logconfigs', {
      params: { cluster, namespace, limit: 10, offset: 0, sortby: 'metadata.name', asc: true, filterby: 'name', filtervalue: 'contract' },
    })
    expect(list.total).toBe(1)
    expect(list.items[0]?.inputs?.[0]?.multiline).toEqual({ active: true, pattern: '^\\[', match: 'after' })

    await call<LogConfigDto>('PUT', item, {
      data: { name, labelSelector: { app: 'replaced' }, inputs: [{ paths: ['/var/log/new.log'], cleanLogs: { retainDays: 3 } }] },
    })
    const fetched = await call<LogConfigDto>('GET', item)
    expect(fetched.labelSelector).toEqual({ app: 'replaced' })
    expect(fetched.inputs).toEqual([{ paths: ['/var/log/new.log'], cleanLogs: { retainDays: 3 } }])
    expect(fetched).not.toHaveProperty('removeOnReplace')

    await call('DELETE', item)
    await expect(call('GET', item)).rejects.toMatchObject({ response: { status: 404 } })
  })

  it('supports _search, availableFields and suggestions with their legacy methods', async () => {
    const search = await call<{ items: unknown[] }>('POST', '/api/v1/logseer/extends/elasticsearch/_search', {
      params: { desensitize: false },
      data: { filters: [{ key: 'logconfig', operator: 'is', value: 'contract-task' }] },
    })
    expect(search.items.length).toBeGreaterThan(0)
    const fields = await call<{ availableFields: string[] }>('GET', '/api/v1/logseer/extends/elasticsearch/availableFields')
    expect(fields.availableFields).toContain('logconfig')
    const suggestions = await call<{ suggestions: string[] }>('POST', '/api/v1/logseer/extends/elasticsearch/suggestions', {
      data: { field: 'message' },
    })
    expect(suggestions.suggestions).toEqual(['message-value'])
  })
})
