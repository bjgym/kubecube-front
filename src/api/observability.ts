import { request, requestResponse } from './http'

export const monitorApi = {
  dashboard: (cluster: string, resource: string) =>
    request<unknown>({
      url: `/api/v1/cube/proxy/clusters/${encodeURIComponent(cluster)}/apis/monitoring.kubecube.io/v1/namespaces/kube-public/dashboards/${encodeURIComponent(resource)}`,
    }),
  componentDashboards: (cluster: string) =>
    request<unknown>({
      url: `/api/v1/cube/proxy/clusters/${encodeURIComponent(cluster)}/apis/monitoring.kubecube.io/v1/namespaces/kubecube-monitoring/dashboards`,
    }),
  labels: (label: string, params?: Record<string, unknown>) =>
    request<unknown>({ url: `/api/v1/label/${encodeURIComponent(label)}/values`, params }),
  series: (params: Record<string, unknown>) => request<unknown>({ url: '/api/v1/series', params }),
  query: (params: Record<string, unknown>) => request<unknown>({ url: '/api/v1/query', params }),
  queryRange: (params: Record<string, unknown>) => request<unknown>({ url: '/api/v1/query_range', params }),
}

export const auditApi = {
  list: (params: Record<string, unknown>) => request<unknown>({ url: '/api/v1/audit', params }),
  export: (params: Record<string, unknown>) => requestResponse<Blob>({ url: '/api/v1/audit/export', params, responseType: 'blob' }),
  enabled: () => request<boolean>({ url: '/api/v1/audit/enabled', silent: true }),
}

export const webconsoleApi = {
  podShell: (cluster: string, namespace: string, pod: string, container: string) =>
    request<unknown>({
      url: `/api/v1/webconsole/${encodeURIComponent(cluster)}/namespace/${encodeURIComponent(namespace)}/pod/${encodeURIComponent(pod)}/shell/${encodeURIComponent(container)}`,
    }),
  cloudShell: (cluster: string, user?: string) =>
    request<unknown>({
      url: `/api/v1/webconsole/extends/cloudShell/clusters/${encodeURIComponent(cluster)}`,
      params: user ? { user } : undefined,
    }),
}
