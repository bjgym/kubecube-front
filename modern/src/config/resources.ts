import type { ResourceDefinition } from '@/api/resource'
import type { KubeResource } from '@/types/api'
import { asText, formatDate, getByPath } from '@/utils/format'

export interface ResourceColumn {
  prop: string
  label: string
  minWidth?: number
  width?: number
  sortable?: boolean
  kind?: 'text' | 'status' | 'date' | 'labels'
  format?: (row: KubeResource) => string
}

export interface ResourceConfig extends ResourceDefinition {
  key: string
  title: string
  shortTitle: string
  description: string
  createLabel?: string
  columns: ResourceColumn[]
  canCreate: boolean
  canEdit: boolean
  canScale?: boolean
  canRestart?: boolean
  tabs: Array<'info' | 'pod' | 'monitor' | 'jobs' | 'event' | 'condition' | 'log' | 'extrnal'>
}

const nameColumn: ResourceColumn = { prop: 'metadata.name', label: '名称', minWidth: 200, sortable: true }
const dateColumn: ResourceColumn = { prop: 'metadata.creationTimestamp', label: '创建时间', width: 176, sortable: true, kind: 'date' }
const statusText = (row: KubeResource) => {
  const status = row.status as Record<string, unknown> | undefined
  if (!status) return '未知'
  if (status.phase) return String(status.phase)
  const replicas = Number(status.replicas ?? (row.spec as Record<string, unknown>)?.replicas ?? 0)
  const ready = Number(status.readyReplicas ?? status.availableReplicas ?? 0)
  return replicas === ready ? `运行正常 · ${ready}/${replicas}` : `副本未就绪 · ${ready}/${replicas}`
}
const containersText = (row: KubeResource) => {
  const spec = row.spec as Record<string, any> | undefined
  const containers = spec?.template?.spec?.containers || spec?.jobTemplate?.spec?.template?.spec?.containers || spec?.containers || []
  return (
    containers
      .map((item: { image?: string }) => item.image)
      .filter(Boolean)
      .join(', ') || '—'
  )
}

const workloadTabs: ResourceConfig['tabs'] = ['info', 'pod', 'monitor', 'event', 'condition', 'log']
const base = {
  namespaced: true,
  canCreate: true,
  canEdit: true,
  tabs: workloadTabs,
}

export const resourceConfigs: ResourceConfig[] = [
  {
    ...base,
    key: 'deployments',
    plural: 'deployments',
    kind: 'Deployment',
    group: 'apps',
    version: 'v1',
    title: 'Deployments',
    shortTitle: 'Deployment',
    description: '管理无状态应用的声明式部署、副本和滚动发布',
    createLabel: '部署应用',
    canScale: true,
    canRestart: true,
    columns: [
      nameColumn,
      { prop: 'images', label: '镜像', minWidth: 260, format: containersText },
      { prop: 'status', label: '状态', minWidth: 180, kind: 'status', format: statusText },
      dateColumn,
    ],
  },
  {
    ...base,
    key: 'statefulsets',
    plural: 'statefulsets',
    kind: 'StatefulSet',
    group: 'apps',
    version: 'v1',
    title: 'StatefulSets',
    shortTitle: 'StatefulSet',
    description: '管理需要稳定身份与持久存储的有状态应用',
    canScale: true,
    canRestart: true,
    columns: [
      nameColumn,
      { prop: 'images', label: '镜像', minWidth: 260, format: containersText },
      { prop: 'status', label: '状态', minWidth: 180, kind: 'status', format: statusText },
      dateColumn,
    ],
  },
  {
    ...base,
    key: 'daemonsets',
    plural: 'daemonsets',
    kind: 'DaemonSet',
    group: 'apps',
    version: 'v1',
    title: 'DaemonSets',
    shortTitle: 'DaemonSet',
    description: '确保集群节点运行指定的守护进程副本',
    columns: [
      nameColumn,
      { prop: 'images', label: '镜像', minWidth: 260, format: containersText },
      { prop: 'status.numberReady', label: '就绪副本', width: 130, format: (row) => asText(getByPath(row, 'status.numberReady')) },
      dateColumn,
    ],
  },
  {
    ...base,
    key: 'cronjobs',
    plural: 'cronjobs',
    kind: 'CronJob',
    group: 'batch',
    version: 'v1',
    title: 'CronJobs',
    shortTitle: 'CronJob',
    description: '按照 Cron 表达式周期创建任务',
    tabs: ['info', 'jobs', 'event'],
    columns: [
      nameColumn,
      { prop: 'spec.schedule', label: '调度规则', width: 160, format: (row) => asText(getByPath(row, 'spec.schedule')) },
      {
        prop: 'spec.suspend',
        label: '状态',
        width: 120,
        kind: 'status',
        format: (row) => (getByPath(row, 'spec.suspend') ? '已暂停' : '运行中'),
      },
      dateColumn,
    ],
  },
  {
    ...base,
    key: 'jobs',
    plural: 'jobs',
    kind: 'Job',
    group: 'batch',
    version: 'v1',
    title: 'Jobs',
    shortTitle: 'Job',
    description: '运行一次性或并行批处理任务',
    canEdit: false,
    columns: [
      nameColumn,
      {
        prop: 'status.succeeded',
        label: '完成 / 目标',
        width: 130,
        format: (row) => `${asText(getByPath(row, 'status.succeeded'))} / ${asText(getByPath(row, 'spec.completions'))}`,
      },
      {
        prop: 'status',
        label: '状态',
        width: 120,
        kind: 'status',
        format: (row) => (getByPath(row, 'status.succeeded') ? '已完成' : '执行中'),
      },
      dateColumn,
    ],
  },
  {
    ...base,
    key: 'pods',
    plural: 'pods',
    kind: 'Pod',
    group: '',
    version: 'v1',
    title: 'Pods',
    shortTitle: 'Pod',
    description: '查看工作负载副本、容器状态与运行日志',
    canCreate: false,
    canEdit: false,
    tabs: ['info', 'monitor', 'event', 'condition', 'log'],
    columns: [
      nameColumn,
      { prop: 'status.podIP', label: 'Pod IP', width: 140 },
      { prop: 'status.phase', label: '状态', width: 120, kind: 'status' },
      {
        prop: 'status.containerStatuses',
        label: '重启次数',
        width: 110,
        format: (row) =>
          String(
            (getByPath(row, 'status.containerStatuses') as Array<{ restartCount?: number }> | undefined)?.reduce(
              (sum, item) => sum + (item.restartCount || 0),
              0,
            ) || 0,
          ),
      },
      { prop: 'spec.nodeName', label: '节点', minWidth: 140 },
      dateColumn,
    ],
  },
  {
    ...base,
    key: 'services',
    plural: 'services',
    kind: 'Service',
    group: '',
    version: 'v1',
    title: 'Services',
    shortTitle: 'Service',
    description: '为应用提供稳定的内部发现与对外访问入口',
    tabs: ['info', 'event', 'extrnal'],
    columns: [
      nameColumn,
      { prop: 'spec.type', label: '类型', width: 130 },
      { prop: 'spec.clusterIP', label: 'Cluster IP', width: 150 },
      {
        prop: 'spec.ports',
        label: '端口',
        minWidth: 160,
        format: (row) =>
          ((getByPath(row, 'spec.ports') as Array<{ port: number; nodePort?: number }> | undefined) || [])
            .map((port) => `${port.port}${port.nodePort ? `:${port.nodePort}` : ''}`)
            .join(', '),
      },
      dateColumn,
    ],
  },
  {
    ...base,
    key: 'ingresses',
    plural: 'ingresses',
    kind: 'Ingress',
    group: 'networking.k8s.io',
    version: 'v1',
    title: 'Ingresses',
    shortTitle: 'Ingress',
    description: '管理 HTTP/HTTPS 路由、域名与 TLS 配置',
    tabs: ['info', 'event'],
    columns: [
      nameColumn,
      { prop: 'spec.ingressClassName', label: 'Ingress Class', width: 150 },
      {
        prop: 'spec.rules',
        label: '域名',
        minWidth: 220,
        format: (row) => ((getByPath(row, 'spec.rules') as Array<{ host?: string }> | undefined) || []).map((rule) => rule.host).join(', '),
      },
      dateColumn,
    ],
  },
  {
    ...base,
    key: 'persistentvolumeclaims',
    plural: 'persistentvolumeclaims',
    kind: 'PersistentVolumeClaim',
    group: '',
    version: 'v1',
    title: '存储声明',
    shortTitle: 'PVC',
    description: '管理应用持久化存储的申请、绑定和扩容',
    createLabel: '创建存储声明',
    canEdit: true,
    tabs: ['info', 'pod', 'monitor'],
    columns: [
      nameColumn,
      { prop: 'status.phase', label: '状态', width: 120, kind: 'status' },
      { prop: 'spec.resources.requests.storage', label: '容量', width: 110 },
      { prop: 'spec.storageClassName', label: '存储类别', minWidth: 150 },
      { prop: 'spec.accessModes', label: '访问模式', minWidth: 150 },
      dateColumn,
    ],
  },
  {
    ...base,
    key: 'configmaps',
    plural: 'configmaps',
    kind: 'ConfigMap',
    group: '',
    version: 'v1',
    title: 'ConfigMaps',
    shortTitle: 'ConfigMap',
    description: '以键值或文件形式管理非敏感应用配置',
    tabs: ['info'],
    columns: [
      nameColumn,
      { prop: 'data', label: '配置项', width: 120, format: (row) => `${Object.keys(row.data || {}).length} 项` },
      dateColumn,
    ],
  },
  {
    ...base,
    key: 'secrets',
    plural: 'secrets',
    kind: 'Secret',
    group: '',
    version: 'v1',
    title: 'Secrets',
    shortTitle: 'Secret',
    description: '管理密码、令牌、证书与镜像仓库凭据',
    tabs: ['info'],
    columns: [
      nameColumn,
      { prop: 'type', label: '类型', minWidth: 220, format: (row) => asText(row.type) },
      { prop: 'data', label: '数据项', width: 120, format: (row) => `${Object.keys(row.data || {}).length} 项` },
      dateColumn,
    ],
  },
  {
    ...base,
    key: 'logconfigs',
    plural: 'logconfigs',
    kind: 'LogConfig',
    group: 'logseer.kubecube.io',
    version: 'v2',
    title: '日志任务',
    shortTitle: 'LogConfig',
    description: '配置容器与节点日志的采集规则',
    tabs: ['info'],
    columns: [
      nameColumn,
      {
        prop: 'spec.inputs',
        label: '日志路径',
        minWidth: 220,
        format: (row) =>
          ((getByPath(row, 'spec.inputs') as Array<{ paths?: string[] }> | undefined) || [])
            .flatMap((input) => input.paths || [])
            .join(', ') || '—',
      },
      {
        prop: 'spec.labelSelector',
        label: '标签选择器',
        minWidth: 180,
        format: (row) =>
          Object.entries((getByPath(row, 'spec.labelSelector') as Record<string, unknown> | undefined) || {})
            .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join('|') : String(value)}`)
            .join(', ') || '—',
      },
      dateColumn,
    ],
  },
  {
    ...base,
    key: 'PrometheusRule',
    plural: 'prometheusrules',
    kind: 'PrometheusRule',
    group: 'monitoring.coreos.com',
    version: 'v1',
    title: '告警规则',
    shortTitle: 'PrometheusRule',
    description: '基于 PromQL 定义应用告警规则',
    tabs: ['info'],
    columns: [
      nameColumn,
      {
        prop: 'spec.groups',
        label: '规则组',
        width: 120,
        format: (row) => `${((getByPath(row, 'spec.groups') as unknown[]) || []).length} 组`,
      },
      dateColumn,
    ],
  },
  {
    ...base,
    key: 'AlertmanagerConfig',
    plural: 'alertmanagerconfigs',
    kind: 'AlertmanagerConfig',
    group: 'monitoring.coreos.com',
    version: 'v1alpha1',
    title: '告警策略组',
    shortTitle: 'AlertmanagerConfig',
    description: '配置告警接收人、路由与通知策略',
    tabs: ['info'],
    columns: [
      nameColumn,
      {
        prop: 'spec.receivers',
        label: '接收人',
        minWidth: 200,
        format: (row) =>
          ((getByPath(row, 'spec.receivers') as Array<{ name: string }> | undefined) || []).map((item) => item.name).join(', '),
      },
      dateColumn,
    ],
  },
]

export const resourceRegistry = new Map(resourceConfigs.map((config) => [config.key, config]))
export const getResourceConfig = (key: string) => resourceRegistry.get(key)
export const defaultResourceYaml = (config: ResourceConfig, namespace: string, name = 'example') => ({
  apiVersion: config.group ? `${config.group}/${config.version}` : config.version,
  kind: config.kind,
  metadata: { name, namespace: config.namespaced ? namespace : undefined },
  ...(config.key === 'configmaps' ? { data: { 'app.properties': 'key=value' } } : {}),
  ...(config.key === 'secrets' ? { type: 'Opaque', stringData: { password: 'change-me' } } : {}),
  ...(!['configmaps', 'secrets'].includes(config.key) ? { spec: {} } : {}),
})

export const valueForColumn = (row: KubeResource, column: ResourceColumn) =>
  column.format
    ? column.format(row)
    : column.kind === 'date'
      ? formatDate(asText(getByPath(row, column.prop)))
      : asText(getByPath(row, column.prop))
