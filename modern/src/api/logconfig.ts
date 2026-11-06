import { logseerApi } from './logseer'
import type { ResourceContext } from './resource'
import type { KubeResource, ListResponse, PaginationQuery } from '@/types/api'

export interface LogConfigInput {
  name?: string
  paths?: string[]
  containerName?: string
  matchFields?: Record<string, string[]>
  fields?: Record<string, string>
  multiline?: { active?: boolean; pattern?: string; [key: string]: unknown }
  ignoreOlder?: string
  excludeFiles?: string[]
  cleanLogs?: { retainDays?: number; retainNum?: number; [key: string]: unknown }
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
  const inputs = Array.isArray(dto.inputs) ? dto.inputs : []
  const firstInput = inputs[0]
  const type = firstInput ? (firstInput.paths?.length === 1 && firstInput.paths[0] === 'stdout' ? 'dockerStdout' : 'k8sLogfile') : undefined
  const path = firstInput?.paths?.[0]
  return {
    ...dto,
    kind: 'LogConfig',
    metadata: {
      name: dto.name,
      namespace: dto.namespace || context.namespace,
      creationTimestamp: dto.createTime,
      labels: Object.fromEntries(
        Object.entries(dto.labelSelector || {}).map(([key, value]) => [key, Array.isArray(value) ? value.join(',') : value]),
      ),
    },
    spec: {
      ...dto,
      ...(type ? { type } : {}),
      ...(path ? { path } : {}),
      cluster: dto.cluster || context.cluster,
      namespace: dto.namespace || context.namespace,
      inputs,
      labelSelector: dto.labelSelector || {},
    },
  }
}

function inputsFromSummary(spec: Record<string, unknown>): LogConfigInput[] {
  const type = typeof spec.type === 'string' ? spec.type : 'dockerStdout'
  const path = typeof spec.path === 'string' ? spec.path : ''
  return [
    {
      name: '',
      paths: type === 'dockerStdout' ? ['stdout'] : path ? [path] : [],
      containerName: '',
      matchFields: {},
      fields: {},
      multiline: { active: false, pattern: '' },
      ignoreOlder: '0h',
      excludeFiles: [],
      cleanLogs: { retainDays: 0 },
    },
  ]
}

export function serializeLogConfig(resource: KubeResource, context: ResourceContext): LogConfigDto {
  const spec = (resource.spec || {}) as Record<string, unknown>
  const { type: _type, path: _path, createTime: _createTime, updateTime: _updateTime, ...fields } = spec
  return {
    ...fields,
    name: resource.metadata.name,
    cluster: context.cluster,
    namespace: context.namespace || resource.metadata.namespace,
    labelSelector: resource.metadata.labels || (spec.labelSelector as Record<string, string | string[]> | undefined) || {},
    inputs: Array.isArray(spec.inputs) ? (spec.inputs as LogConfigInput[]) : inputsFromSummary(spec),
  }
}

export async function listLogConfigs(context: ResourceContext, params: Partial<PaginationQuery> = {}): Promise<ListResponse<KubeResource>> {
  const pageSize = Math.max(1, Number(params.pageSize) || 10)
  const pageNum = Math.max(1, Number(params.pageNum) || 1)
  const selector = params.selector || ''
  const filtervalue = selector.match(/metadata\.name~(.+)/)?.[1] || ''
  const sortby = params.sortName
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
  const dto = serializeLogConfig(resource, context)
  const response = (await logseerApi.createConfig(context.cluster, context.namespace || '', dto)) as LogConfigDto | KubeResource | null
  return normalizeLogConfig(response || dto, context)
}

export async function replaceLogConfig(context: ResourceContext, resource: KubeResource): Promise<KubeResource> {
  const dto = serializeLogConfig(resource, context)
  const response = (await logseerApi.updateConfig(
    context.cluster,
    context.namespace || '',
    context.name || resource.metadata.name,
    dto,
  )) as LogConfigDto | KubeResource | null
  return normalizeLogConfig(response || dto, context)
}

export async function deleteLogConfig(context: ResourceContext): Promise<void> {
  await logseerApi.deleteConfig(context.cluster, context.namespace || '', context.name || '')
}
