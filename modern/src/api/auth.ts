import { request, requestResponse } from './http'
import type { RoleIdentities, UserAccount, KubeResource, ListResponse } from '@/types/api'

export interface LoginPayload {
  loginType: string
  name: string
  password: string
}
export interface LoginResponse {
  metadata: { name: string }
  spec: { displayName: string }
}

export const authApi = {
  login: (data: LoginPayload) => request<LoginResponse>({ url: '/api/v1/cube/login', method: 'POST', data }),
  oauth: (params: Record<string, string>) => request<LoginResponse>({ url: '/api/v1/cube/oauth/redirect', params }),
  identities: (user: string) => request<RoleIdentities>({ url: '/api/v1/cube/authorization/identities', params: { user } }),
  features: () => request<Record<string, string> | null>({ url: '/api/v1/cube/extend/feature-config', silent: true }),
  ssoConfig: () => request<Record<string, string>>({ url: '/api/v1/cube/extend/configmap/kubecube-auth-config', silent: true }),
}

export const userApi = {
  list: (params?: Record<string, unknown>) =>
    request<ListResponse<KubeResource>>({ url: '/api/v1/cube/user', params, withCredentials: true }),
  create: (data: unknown) => request<KubeResource>({ url: '/api/v1/cube/user', method: 'POST', data, withCredentials: true }),
  update: (user: string, data: unknown) =>
    request<KubeResource>({ url: `/api/v1/cube/user/${encodeURIComponent(user)}`, method: 'PUT', data, withCredentials: true }),
  changePassword: (data: unknown) => request<void>({ url: '/api/v1/cube/user/pwd', method: 'PUT', data }),
  downloadTemplate: () => requestResponse<Blob>({ url: '/api/v1/cube/user/template', responseType: 'blob' }),
  importUsers: (data: unknown) => request<void>({ url: '/api/v1/cube/user/users', method: 'POST', data }),
  downloadKubeconfigs: () => requestResponse<Blob>({ url: '/api/v1/cube/user/kubeconfigs', responseType: 'blob' }),
  tenants: (user: string) => request<ListResponse<KubeResource>>({ url: '/api/v1/cube/authorization/tenants', params: { user } }),
  projects: (user: string, tenant: string) =>
    request<ListResponse<KubeResource>>({ url: '/api/v1/cube/authorization/projects', params: { user, tenant } }),
  permissions: (data: unknown) => request<Record<string, boolean>>({ url: '/api/v1/cube/authorization/resources', method: 'POST', data }),
  roles: () => request<ListResponse<KubeResource>>({ url: '/api/v1/cube/authorization/roles' }),
  clusterRoles: (level?: string) =>
    request<ListResponse<KubeResource>>({ url: '/api/v1/cube/authorization/clusterroles', params: level ? { level } : undefined }),
  createBinding: (data: unknown) => request<void>({ url: '/api/v1/cube/authorization/bindings', method: 'POST', data }),
  deleteBinding: (data: unknown) => request<void>({ url: '/api/v1/cube/authorization/bindings', method: 'DELETE', params: data }),
  catalogue: () => request<unknown>({ url: '/api/v1/cube/authorization/catalogue' }),
  roleItems: (name: string) => request<unknown>({ url: `/api/v1/cube/authorization/roles/${encodeURIComponent(name)}` }),
  saveRoleItems: (name: string, data: unknown) =>
    request<void>({ url: `/api/v1/cube/authorization/roles/${encodeURIComponent(name)}`, method: 'PUT', data }),
  deleteRole: (name: string) => request<void>({ url: `/api/v1/cube/authorization/roles/${encodeURIComponent(name)}`, method: 'DELETE' }),
  keys: () => request<ListResponse<Record<string, unknown>>>({ url: '/api/v1/cube/key' }),
  createKey: () => request<Record<string, unknown>>({ url: '/api/v1/cube/key/create', method: 'POST' }),
  deleteKey: (accessKey: string) => request<void>({ url: '/api/v1/cube/key', method: 'DELETE', params: { accessKey } }),
}

export function accountFromLogin(response: LoginResponse): UserAccount {
  return { AccountId: response.metadata.name, AccountDisplayName: response.spec.displayName }
}
