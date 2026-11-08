import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ request: vi.fn().mockResolvedValue({ hits: { hits: [], total: 0 } }) }))

vi.mock('@/api/http', () => ({ request: mocks.request }))

import { logseerApi } from '@/api/logseer'

describe('Logseer request contract', () => {
  beforeEach(() => mocks.request.mockClear())

  it('posts the legacy search body to _search with desensitize as a query parameter', async () => {
    const body = { query: 'status:200', from: 0, size: 50, filters: [{ key: 'logconfig', operator: 'is', value: 'shop' }] }
    await logseerApi.search(body)
    expect(mocks.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/v1/logseer/extends/elasticsearch/_search',
        method: 'POST',
        data: body,
        params: { desensitize: false },
      }),
    )
  })

  it('uses GET for availableFields and POST with a body for suggestions', async () => {
    await logseerApi.fields({ type: 'container' })
    expect(mocks.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/v1/logseer/extends/elasticsearch/availableFields',
        method: 'GET',
        params: { type: 'container' },
      }),
    )
    const body = { field: 'message', filters: [] }
    await logseerApi.suggestions(body)
    expect(mocks.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/v1/logseer/extends/elasticsearch/suggestions',
        method: 'POST',
        data: body,
      }),
    )
  })

  it('uses the flat v2 list endpoint with legacy pagination and filtering params', async () => {
    const params = {
      cluster: 'prod',
      namespace: 'shop',
      limit: 20,
      offset: 40,
      sortby: 'name',
      asc: true,
      filterby: 'name',
      filtervalue: 'web',
    }
    await logseerApi.configs(params)
    expect(mocks.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/v2/logseer/extends/logconfigs',
        method: 'GET',
        params,
      }),
    )
  })

  it('keeps logconfig instance CRUD on the cluster and namespace v2 paths', async () => {
    const path = '/api/v2/logseer/extends/clusters/prod%2Feast/namespaces/team%20a/logconfigs'
    const body = { name: 'web/blue', inputs: [{ paths: ['stdout'] }] }
    await logseerApi.getConfig('prod/east', 'team a', 'web/blue')
    expect(mocks.request).toHaveBeenLastCalledWith(expect.objectContaining({ url: `${path}/web%2Fblue`, method: 'GET' }))
    await logseerApi.createConfig('prod/east', 'team a', body)
    expect(mocks.request).toHaveBeenLastCalledWith(expect.objectContaining({ url: path, method: 'POST', data: body }))
    await logseerApi.updateConfig('prod/east', 'team a', 'web/blue', body)
    expect(mocks.request).toHaveBeenLastCalledWith(expect.objectContaining({ url: `${path}/web%2Fblue`, method: 'PUT', data: body }))
    await logseerApi.deleteConfig('prod/east', 'team a', 'web/blue')
    expect(mocks.request).toHaveBeenLastCalledWith(expect.objectContaining({ url: `${path}/web%2Fblue`, method: 'DELETE' }))
  })
})
