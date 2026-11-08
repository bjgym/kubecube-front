import { request } from './http'
import type { KubeResource, ListResponse } from '@/types/api'

const controlBase = (controlCluster: string) => `/api/v1/cube/proxy/clusters/${encodeURIComponent(controlCluster)}`

export const scopeApi = {
  list: (controlCluster: string, scope: 'tenants' | 'projects', params?: Record<string, unknown>) =>
    request<ListResponse<KubeResource>>({ url: `${controlBase(controlCluster)}/apis/tenant.kubecube.io/v1/${scope}`, params }),
  create: (controlCluster: string, scope: 'tenants' | 'projects', data: unknown) =>
    request<KubeResource>({ url: `${controlBase(controlCluster)}/apis/tenant.kubecube.io/v1/${scope}`, method: 'POST', data }),
  get: (controlCluster: string, scope: 'tenants' | 'projects', name: string) =>
    request<KubeResource>({
      url: `${controlBase(controlCluster)}/apis/tenant.kubecube.io/v1/${scope}/${encodeURIComponent(name)}`,
      method: 'POST',
    }),
  patch: (controlCluster: string, scope: 'tenants' | 'projects', name: string, data: unknown) =>
    request<KubeResource>({
      url: `${controlBase(controlCluster)}/apis/tenant.kubecube.io/v1/${scope}/${encodeURIComponent(name)}`,
      method: 'PATCH',
      data,
      headers: { 'Content-Type': 'application/merge-patch+json' },
    }),
  delete: (controlCluster: string, scope: 'tenants' | 'projects', name: string) =>
    request<void>({
      url: `${controlBase(controlCluster)}/apis/tenant.kubecube.io/v1/${scope}/${encodeURIComponent(name)}`,
      method: 'DELETE',
    }),
  quotas: (controlCluster: string) =>
    request<ListResponse<KubeResource>>({ url: `${controlBase(controlCluster)}/apis/quota.kubecube.io/v1/cuberesourcequota` }),
  quota: (controlCluster: string, name: string) =>
    request<KubeResource>({
      url: `${controlBase(controlCluster)}/apis/quota.kubecube.io/v1/cuberesourcequota/${encodeURIComponent(name)}`,
      silent: true,
    }),
  createQuota: (controlCluster: string, data: unknown) =>
    request<KubeResource>({ url: `${controlBase(controlCluster)}/apis/quota.kubecube.io/v1/cuberesourcequota`, method: 'POST', data }),
  patchQuota: (controlCluster: string, name: string, data: unknown) =>
    request<KubeResource>({
      url: `${controlBase(controlCluster)}/apis/quota.kubecube.io/v1/cuberesourcequota/${encodeURIComponent(name)}`,
      method: 'PATCH',
      data,
      headers: { 'Content-Type': 'application/merge-patch+json' },
    }),
}
