export interface ListResponse<T> {
  items: T[]
  total?: number
  metadata?: { continue?: string; resourceVersion?: string }
}

export interface SelectOption {
  label: string
  value: string
  description?: string
  disabled?: boolean
}

export interface UserAccount {
  AccountId: string
  AccountDisplayName: string
}

export interface RoleIdentities {
  platformAdmin?: boolean
  tenantAdmin?: boolean
  projectAdmin?: boolean
  [key: string]: unknown
}

export type ManagerRole = 'platformAdmin' | 'tenantAdmin' | 'projectAdmin'

export interface ClusterInfo {
  clusterName: string
  clusterDisplayName?: string
  clusterDescription?: string
  isMemberCluster: boolean
  usedCpu?: number
  totalCpu?: number
  usedMem?: number
  totalMem?: number
  nodeCount?: number
  namespaceCount?: number
  status?: 'normal' | 'abnormal' | 'processing' | 'deleting' | string
  annotations?: Record<string, string>
  [key: string]: unknown
}

export interface NamespaceInfo {
  metadata: KubeMetadata
  cluster?: string
  status?: { phase?: string }
  [key: string]: unknown
}

export interface KubeMetadata {
  name: string
  namespace?: string
  uid?: string
  creationTimestamp?: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
  resourceVersion?: string
  [key: string]: unknown
}

export interface KubeResource<TSpec = Record<string, unknown>, TStatus = Record<string, unknown>> {
  apiVersion?: string
  kind?: string
  metadata: KubeMetadata
  spec?: TSpec
  status?: TStatus
  data?: Record<string, string>
  [key: string]: unknown
}

export interface PaginationQuery {
  pageNum: number
  pageSize: number
  selector?: string
  sortName?: string
  sortOrder?: 'asc' | 'desc'
  sortFunc?: 'time' | 'string'
}

export interface ApiErrorBody {
  message?: string
  reason?: string
  code?: number
}
