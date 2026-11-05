import { request } from './http'
import type { ClusterInfo, KubeResource, ListResponse, NamespaceInfo } from '@/types/api'

export const clusterApi = {
  list: (params?: Record<string, unknown>) => request<ListResponse<ClusterInfo>>({ url: '/api/v1/cube/clusters/info', params }),
  visible: (params?: Record<string, unknown>) =>
    request<ListResponse<string | ClusterInfo>>({ url: '/api/v1/cube/clusters/namespaces', params }),
  resources: () => request<unknown>({ url: '/api/v1/cube/clusters/resources' }),
  subnamespaces: (params?: Record<string, unknown>) =>
    request<ListResponse<KubeResource>>({ url: '/api/v1/cube/clusters/subnamespaces', params }),
  add: (data: unknown) => request<ClusterInfo>({ url: '/api/v1/cube/clusters/add', method: 'POST', data }),
  onboardNamespace: (data: unknown) => request<void>({ url: '/api/v1/cube/clusters/nsquota/onboard', method: 'POST', data }),
}

export const namespaceApi = {
  list: (cluster: string, params?: Record<string, unknown>) =>
    request<ListResponse<NamespaceInfo>>({ url: `/api/v1/cube/proxy/clusters/${encodeURIComponent(cluster)}/api/v1/namespaces`, params }),
  get: (cluster: string, name: string) =>
    request<NamespaceInfo>({
      url: `/api/v1/cube/proxy/clusters/${encodeURIComponent(cluster)}/api/v1/namespaces/${encodeURIComponent(name)}`,
    }),
  update: (cluster: string, name: string, data: unknown) =>
    request<NamespaceInfo>({
      url: `/api/v1/cube/proxy/clusters/${encodeURIComponent(cluster)}/api/v1/namespaces/${encodeURIComponent(name)}`,
      method: 'PUT',
      data,
    }),
  createQuota: (data: unknown) => request<void>({ url: '/api/v1/cube/clusters/nsquota', method: 'POST', data }),
}
