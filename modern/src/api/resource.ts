import { request } from './http'
import { createLogConfig, deleteLogConfig, getLogConfig, listLogConfigs, replaceLogConfig } from './logconfig'
import type { KubeResource, ListResponse, PaginationQuery } from '@/types/api'

export interface ResourceContext {
  cluster: string
  namespace?: string
  name?: string
}

export interface ResourceDefinition {
  plural: string
  kind: string
  group?: string
  version: string
  namespaced: boolean
}

export interface ExternalAccessPort {
  protocol: string
  servicePort: number
  servicePortName?: string
  externalPort?: number
}

export type ExternalAccessPortUpdate = Pick<ExternalAccessPort, 'protocol' | 'servicePort'> &
  ({ externalPort: number } | { externalPort?: never })

export interface PodLogLine {
  timestamp: string
  content: string
}

export interface PodLogSelection {
  referencePoint: {
    timestamp: string
    lineNum: number
  }
  offsetFrom: number
  offsetTo: number
  logFilePosition: 'beginning' | 'end'
}

export interface PodLogInfo {
  podName: string
  containerName: string
  initContainerName?: string
  fromDate?: string
  toDate?: string
  truncated?: boolean
}

export interface PodLogDetails {
  info: PodLogInfo
  selection: PodLogSelection
  logs: PodLogLine[]
}

export interface PodLogQuery {
  containerName: string
  offsetFrom: number
  offsetTo: number
  referenceTimestamp: string
  referenceLineNum: number
  logFilePosition: 'beginning' | 'end'
  previous: boolean
}

export function resourcePath(definition: ResourceDefinition, context: ResourceContext, includeName = false): string {
  const groupPath = definition.group ? `/apis/${definition.group}/${definition.version}` : `/api/${definition.version}`
  const namespacePath = definition.namespaced ? `/namespaces/${encodeURIComponent(context.namespace || '')}` : ''
  const namePath = includeName && context.name ? `/${encodeURIComponent(context.name)}` : ''
  return `/api/v1/cube/proxy/clusters/${encodeURIComponent(context.cluster)}${groupPath}${namespacePath}/${definition.plural}${namePath}`
}

function externalAccessPath(cluster: string, namespace: string, name: string): string {
  return `/api/v1/cube/extend/clusters/${encodeURIComponent(cluster)}/namespaces/${encodeURIComponent(namespace)}/externalAccess/${encodeURIComponent(name)}`
}

export function pvcPodsPath(cluster: string, namespace: string, name: string): string {
  return `/api/v1/cube/extend/clusters/${encodeURIComponent(cluster)}/namespaces/${encodeURIComponent(namespace)}/pvcworkloads/${encodeURIComponent(name)}`
}

export interface PvcPodsResponse {
  pods: Array<KubeResource & { reason?: string }>
  total: number
}

const isLogConfig = (definition: ResourceDefinition) => definition.kind === 'LogConfig'

export const resourceApi = {
  list: (definition: ResourceDefinition, context: ResourceContext, params?: Partial<PaginationQuery>, options?: { silent?: boolean }) =>
    isLogConfig(definition)
      ? listLogConfigs(context, params)
      : request<ListResponse<KubeResource>>({ url: resourcePath(definition, context), params, silent: options?.silent }),
  get: (definition: ResourceDefinition, context: ResourceContext) =>
    isLogConfig(definition) ? getLogConfig(context) : request<KubeResource>({ url: resourcePath(definition, context, true) }),
  create: (definition: ResourceDefinition, context: ResourceContext, data: unknown) =>
    isLogConfig(definition)
      ? createLogConfig(context, data as KubeResource)
      : request<KubeResource>({ url: resourcePath(definition, context), method: 'POST', data }),
  replace: (definition: ResourceDefinition, context: ResourceContext, data: unknown, yaml = false) =>
    isLogConfig(definition)
      ? replaceLogConfig(context, data as KubeResource)
      : request<KubeResource>({
          url: resourcePath(definition, context, true),
          method: 'PUT',
          data,
          headers: yaml ? { 'Content-Type': 'application/yaml' } : undefined,
        }),
  patch: (
    definition: ResourceDefinition,
    context: ResourceContext,
    data: unknown,
    strategy: 'strategic' | 'merge' | 'json' = 'strategic',
  ) => {
    const contentTypes = {
      strategic: 'application/strategic-merge-patch+json',
      merge: 'application/merge-patch+json',
      json: 'application/json-patch+json',
    }
    return request<KubeResource>({
      url: resourcePath(definition, context, true),
      method: 'PATCH',
      data,
      headers: { 'Content-Type': contentTypes[strategy] },
    })
  },
  delete: (definition: ResourceDefinition, context: ResourceContext) =>
    isLogConfig(definition) ? deleteLogConfig(context) : request<void>({ url: resourcePath(definition, context, true), method: 'DELETE' }),
  getExternalAccess: (cluster: string, namespace: string, name: string) =>
    request<ExternalAccessPort[]>({ url: externalAccessPath(cluster, namespace, name) }),
  setExternalAccess: (cluster: string, namespace: string, name: string, data: ExternalAccessPortUpdate[]) =>
    request<void>({ url: externalAccessPath(cluster, namespace, name), method: 'POST', data }),
  pvcPods: (cluster: string, namespace: string, name: string) => request<PvcPodsResponse>({ url: pvcPodsPath(cluster, namespace, name) }),
  deployYaml: (cluster: string, data: unknown, dryRun = false) =>
    request<unknown>({
      url: `/api/v1/cube/extend/clusters/${encodeURIComponent(cluster)}/yaml/deploy`,
      method: 'POST',
      data,
      params: dryRun ? { dryRun: true } : undefined,
    }),
  podLogs: (cluster: string, namespace: string, pod: string, params: PodLogQuery) =>
    request<PodLogDetails>({
      url: `/api/v1/cube/extend/clusters/${encodeURIComponent(cluster)}/namespaces/${encodeURIComponent(namespace)}/logs/${encodeURIComponent(pod)}`,
      params,
    }),
  evictPod: (cluster: string, namespace: string, name: string, data?: unknown) =>
    request<void>({
      url: `/api/v1/cube/proxy/clusters/${encodeURIComponent(cluster)}/api/v1/namespaces/${encodeURIComponent(namespace)}/pods/${encodeURIComponent(name)}/eviction`,
      method: 'POST',
      data,
    }),
}
