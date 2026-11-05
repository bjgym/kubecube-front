import { logseerApi } from './logseer'
import type { ResourceContext } from './resource'
import type { KubeResource, ListResponse, PaginationQuery } from '@/types/api'

export interface LogConfigInput {
  name?: string
  paths?: string[]
  containerName?: string
  matchFields?: Record<string, string[]>
  fields?: Record<string, string>
  multiline?: { active?: boolean; pattern?: string }
  ignoreOlder?: string
  excludeFiles?: string[]
  cleanLogs?: { retainDays?: number }
  [key: string]: unknown
}

export interface LogConfigDto {
  name: string
  cluster?: string
  namespace?: string
  labelSelector?: Record<string, string | string[]>
  inputs?: LogConfigInput[]
  createTime?: string
  updateTime?: string
  [key: string]: unknown
}

interface LogConfigResponse {
  items?: Array<LogConfigDto | KubeResource>
  total?: number
}

export function normalizeLogConfig(item: LogConfigDto | KubeResource, context: ResourceContext): KubeResource {
  const candidate = item as KubeResource
  if (candidate.metadata?.name) return candidate
  const dto = item as LogConfigDto
  return {
    apiVersion: 'logseer.kubecube.io/v2',
    kind: 'LogConfig',
    metadata: {
      name: dto.name,
      namespace: dto.namespace || context.namespace,
      creationTimestamp: dto.createTime,
      annotations: {},
      labels: {},
    },
    spec: {
      ...dto,
      cluster: dto.cluster || context.cluster,
      namespace: dto.namespace || context.namespace,
      inputs: dto.inputs || [],
      labelSelector: dto.labelSelector || {},
    },
  }
}

export function serializeLogConfig(resource: KubeResource, context: ResourceContext): LogConfigDto {
  const spec = (resource.spec || {}) as Record<string, any>
  return {
    ...spec,
    name: resource.metadata.name,
    cluster: context.cluster,
    namespace: context.namespace,
    labelSelector: (spec.labelSelector || {}) as Record<string, string | string[]>,
    inputs: (Array.isArray(spec.inputs) ? spec.inputs : []) as LogConfigInput[],
  }
}

export async function listLogConfigs(context: ResourceContext, params: Partial<PaginationQuery> = {}): Promise<ListResponse<KubeResource>> {
  const pageSize = Math.max(1, Number(params.pageSize) || 10)
  const pageNum = Math.max(1, Number(params.pageNum) || 1)
  const selector = params.selector || ''
  const filtervalue = selector.match(/metadata\.name~(.+)/)?.[1] || ''
  const sortby =
    params.sortName === 'metadata.name'
      ? 'name'
      : params.sortName === 'metadata.creationTimestamp'
        ? 'createTime'
        : params.sortName || 'name'
  const response = (await logseerApi.configs({
    cluster: context.cluster,
    namespace: context.namespace || '',
    limit: pageSize,
    offset: (pageNum - 1) * pageSize,
    sortby,
    asc: params.sortOrder === 'asc',
    filterby: 'name',
    filtervalue,
  })) as LogConfigResponse
  const items = (response.items || []).map((item) => normalizeLogConfig(item, context))
  return { items, total: response.total ?? items.length }
}

export async function getLogConfig(context: ResourceContext): Promise<KubeResource> {
  const response = (await logseerApi.getConfig(context.cluster, context.namespace || '', context.name || '')) as LogConfigDto | KubeResource
  return normalizeLogConfig(response, context)
}

export async function createLogConfig(context: ResourceContext, resource: KubeResource): Promise<KubeResource> {
  const response = (await logseerApi.createConfig(context.cluster, context.namespace || '', serializeLogConfig(resource, context))) as
    LogConfigDto | KubeResource
  return normalizeLogConfig(response, context)
}

export async function replaceLogConfig(context: ResourceContext, resource: KubeResource): Promise<KubeResource> {
  const response = (await logseerApi.updateConfig(
    context.cluster,
    context.namespace || '',
    context.name || resource.metadata.name,
    serializeLogConfig(resource, context),
  )) as LogConfigDto | KubeResource
  return normalizeLogConfig(response, context)
}

export async function deleteLogConfig(context: ResourceContext): Promise<void> {
  await logseerApi.deleteConfig(context.cluster, context.namespace || '', context.name || '')
}
