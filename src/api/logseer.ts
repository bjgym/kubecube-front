import { request } from './http'

const authHeaders = { 'x-auth-accountId': '0', 'x-auth-projectId': '0', 'x-auth-tenantId': '0' }
const logconfigPath = (cluster: string, namespace: string, name?: string) =>
  `/api/v2/logseer/extends/clusters/${encodeURIComponent(cluster)}/namespaces/${encodeURIComponent(namespace)}/logconfigs${name ? `/${encodeURIComponent(name)}` : ''}`

export interface LogConfigListParams {
  cluster: string
  namespace: string
  limit?: number
  offset?: number
  sortby?: string
  asc?: boolean
  filterby?: string
  filtervalue?: string
}

export const logseerApi = {
  configs: (params: LogConfigListParams) =>
    request<unknown>({ url: '/api/v2/logseer/extends/logconfigs', method: 'GET', params, headers: authHeaders }),
  getConfig: (cluster: string, namespace: string, name: string) =>
    request<unknown>({ url: logconfigPath(cluster, namespace, name), method: 'GET', headers: authHeaders }),
  createConfig: (cluster: string, namespace: string, data: unknown) =>
    request<unknown>({ url: logconfigPath(cluster, namespace), method: 'POST', data, headers: authHeaders }),
  updateConfig: (cluster: string, namespace: string, name: string, data: unknown) =>
    request<unknown>({ url: logconfigPath(cluster, namespace, name), method: 'PUT', data, headers: authHeaders }),
  deleteConfig: (cluster: string, namespace: string, name: string) =>
    request<void>({ url: logconfigPath(cluster, namespace, name), method: 'DELETE', headers: authHeaders }),
  labelSelectorKeys: () => request<unknown>({ url: '/api/v1/logseer/extends/labelSelectorKey', headers: authHeaders }),
  search: (data: unknown) =>
    request<unknown>({
      url: '/api/v1/logseer/extends/elasticsearch/_search',
      method: 'POST',
      data,
      params: { desensitize: false },
      headers: authHeaders,
    }),
  fields: (params?: Record<string, unknown>) =>
    request<unknown>({ url: '/api/v1/logseer/extends/elasticsearch/availableFields', method: 'GET', params, headers: authHeaders }),
  suggestions: (data: unknown) =>
    request<unknown>({ url: '/api/v1/logseer/extends/elasticsearch/suggestions', method: 'POST', data, headers: authHeaders }),
}
