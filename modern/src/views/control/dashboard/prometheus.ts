/**
 * Pure Prometheus helpers for the KubeCube monitoring views: query construction,
 * escaping, step calculation and response conversion.
 *
 * These functions never touch the network or the Vue component; the view calls
 * them and performs the requests itself.
 */

import type {
  ChartDefinition,
  ContextKind,
  DashboardTableStyle,
  DashboardTarget,
  MetricDefinition,
  QueryDefinition,
  SeriesState,
} from './parser'

export interface PrometheusContext {
  contextKind: ContextKind
  cluster: string
  namespace: string
  workload: string
  instance: string
  node: string
}

/** Escape a value that is interpolated inside a double-quoted PromQL label matcher. */
export function escapePrometheus(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/** Escape a value that is interpolated inside a PromQL regex matcher. */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** The base label matchers for the current monitoring context. */
export function baseLabels(context: PrometheusContext): string[] {
  const labels = [`cluster="${escapePrometheus(context.cluster)}"`]
  if (context.contextKind === 'namespace' || context.contextKind === 'workload')
    labels.push(`namespace="${escapePrometheus(context.namespace)}"`)
  if (context.contextKind === 'workload')
    labels.push(
      context.workload === 'pods' ? `pod="${escapePrometheus(context.instance)}"` : `pod=~"^${escapeRegex(context.instance)}(-.*)?$"`,
    )
  if (context.node) labels.push(`instance=~"^${escapeRegex(context.node)}(:.*)?$"`)
  return labels
}

/** Render a `{...}` label matcher set, merging the base labels with extra matchers. */
export function prometheusLabels(context: PrometheusContext, ...extra: string[]): string {
  return `{${[...baseLabels(context), ...extra].join(',')}}`
}

/** The four built-in trend charts for the current context (cluster / component / workload / namespace). */
export function buildChartDefinitions(context: PrometheusContext): ChartDefinition[] {
  if (context.contextKind === 'cluster') {
    const cpu = `sum(rate(node_cpu_seconds_total${prometheusLabels(context, 'mode!="idle"')}[5m]))`
    const memory = `sum(node_memory_MemTotal_bytes${prometheusLabels(context)}) - sum(node_memory_MemAvailable_bytes${prometheusLabels(context)})`
    const receive = `sum(rate(node_network_receive_bytes_total${prometheusLabels(context, 'device!~"lo|veth.*|docker.*|cni.*|flannel.*"')}[5m]))`
    const transmit = `sum(rate(node_network_transmit_bytes_total${prometheusLabels(context, 'device!~"lo|veth.*|docker.*|cni.*|flannel.*"')}[5m]))`
    return [
      {
        key: 'cpu',
        title: 'CPU 使用量',
        description: '非空闲 CPU 时间汇总',
        footer: '单位：Core',
        unit: 'cpu',
        queries: [{ name: 'CPU 使用', query: cpu, color: '#5b6cff' }],
      },
      {
        key: 'memory',
        title: '内存使用量',
        description: '总内存减去可用内存',
        footer: '单位：字节',
        unit: 'memory',
        queries: [{ name: '内存使用', query: memory, color: '#12b76a' }],
      },
      {
        key: 'network',
        title: '网络吞吐',
        description: '节点物理与业务网卡速率',
        footer: '单位：字节 / 秒',
        unit: 'bytesPerSecond',
        queries: [
          { name: '接收', query: receive, color: '#2e90fa' },
          { name: '发送', query: transmit, color: '#f79009' },
        ],
      },
      {
        key: 'capacity',
        title: 'CPU 容量',
        description: '节点总容量与可分配容量',
        footer: '单位：Core',
        unit: 'cpu',
        queries: [
          { name: '总容量', query: `sum(kube_node_status_capacity${prometheusLabels(context, 'resource="cpu"')})`, color: '#7a5af8' },
          { name: '可分配', query: `sum(kube_node_status_allocatable${prometheusLabels(context, 'resource="cpu"')})`, color: '#12b76a' },
        ],
      },
    ]
  }
  if (context.contextKind === 'component') {
    return [
      {
        key: 'cpu',
        title: '进程 CPU 使用量',
        description: '组件进程 CPU 时间速率',
        footer: '单位：Core',
        unit: 'cpu',
        queries: [{ name: 'CPU 使用', query: `sum(rate(process_cpu_seconds_total${prometheusLabels(context)}[5m]))`, color: '#5b6cff' }],
      },
      {
        key: 'memory',
        title: '进程常驻内存',
        description: '组件进程 Resident Set Size',
        footer: '单位：字节',
        unit: 'memory',
        queries: [{ name: '常驻内存', query: `sum(process_resident_memory_bytes${prometheusLabels(context)})`, color: '#12b76a' }],
      },
      {
        key: 'network',
        title: '请求速率',
        description: 'HTTP 总请求与 5xx 请求',
        footer: '单位：请求 / 秒',
        unit: 'requestsPerSecond',
        queries: [
          { name: '全部请求', query: `sum(rate(http_requests_total${prometheusLabels(context)}[5m]))`, color: '#2e90fa' },
          { name: '5xx 请求', query: `sum(rate(http_requests_total${prometheusLabels(context, 'code=~"5.."')}[5m]))`, color: '#f04438' },
        ],
      },
      {
        key: 'capacity',
        title: '文件描述符',
        description: '进程已打开与最大文件描述符',
        footer: '单位：个',
        unit: 'fileDescriptors',
        queries: [
          { name: '已打开', query: `sum(process_open_fds${prometheusLabels(context)})`, color: '#7a5af8' },
          { name: '最大值', query: `sum(process_max_fds${prometheusLabels(context)})`, color: '#f79009' },
        ],
      },
    ]
  }
  const cpu = `sum(rate(container_cpu_usage_seconds_total${prometheusLabels(context, 'container!=""', 'image!=""')}[5m]))`
  const memory = `sum(container_memory_working_set_bytes${prometheusLabels(context, 'container!=""', 'image!=""')})`
  const receive = `sum(rate(container_network_receive_bytes_total${prometheusLabels(context)}[5m]))`
  const transmit = `sum(rate(container_network_transmit_bytes_total${prometheusLabels(context)}[5m]))`
  return [
    {
      key: 'cpu',
      title: 'CPU 使用量',
      description: '关联容器的 CPU 使用速率',
      footer: '单位：Core',
      unit: 'cpu',
      queries: [{ name: 'CPU 使用', query: cpu, color: '#5b6cff' }],
    },
    {
      key: 'memory',
      title: '内存使用量',
      description: '容器 Working Set 内存汇总',
      footer: '单位：字节',
      unit: 'memory',
      queries: [{ name: '内存使用', query: memory, color: '#12b76a' }],
    },
    {
      key: 'network',
      title: '网络吞吐',
      description: '关联 Pod 网络接收与发送速率',
      footer: '单位：字节 / 秒',
      unit: 'bytesPerSecond',
      queries: [
        { name: '接收', query: receive, color: '#2e90fa' },
        { name: '发送', query: transmit, color: '#f79009' },
      ],
    },
    {
      key: 'capacity',
      title: 'CPU Request / Limit',
      description: '关联容器的 CPU 请求与限制',
      footer: '单位：Core',
      unit: 'cpu',
      queries: [
        {
          name: 'Request',
          query: `sum(kube_pod_container_resource_requests${prometheusLabels(context, 'resource="cpu"')})`,
          color: '#2e90fa',
        },
        { name: 'Limit', query: `sum(kube_pod_container_resource_limits${prometheusLabels(context, 'resource="cpu"')})`, color: '#f79009' },
      ],
    },
  ]
}

/** The four built-in single-value metric cards, derived from the trend chart queries. */
export function buildMetricDefinitions(context: PrometheusContext, charts: ChartDefinition[]): MetricDefinition[] {
  const cpu = charts.find((item) => item.key === 'cpu')!.queries[0]!.query
  const memory = charts.find((item) => item.key === 'memory')!.queries[0]!.query
  const networkQueries = charts.find((item) => item.key === 'network')!.queries
  const network =
    context.contextKind === 'component' ? networkQueries[0]!.query : `(${networkQueries[0]!.query}) + (${networkQueries[1]!.query})`
  const available =
    context.contextKind === 'cluster'
      ? `count(kube_node_info${prometheusLabels(context)})`
      : context.contextKind === 'component'
        ? `sum(up${prometheusLabels(context)})`
        : `count(kube_pod_info${prometheusLabels(context)})`
  const availableLabel = context.contextKind === 'cluster' ? '节点数量' : context.contextKind === 'component' ? '健康组件实例' : '关联 Pods'
  return [
    { key: 'cpu', label: 'CPU 当前用量', caption: '最近瞬时查询', unit: 'cpu', query: cpu, tone: 'brand' },
    { key: 'memory', label: '内存当前用量', caption: '最近瞬时查询', unit: 'memory', query: memory, tone: 'success' },
    {
      key: 'network',
      label: context.contextKind === 'component' ? '当前请求速率' : '当前网络吞吐',
      caption: '接收与发送聚合',
      unit: context.contextKind === 'component' ? 'requestsPerSecond' : 'bytesPerSecond',
      query: network,
      tone: 'info',
    },
    { key: 'available', label: availableLabel, caption: '当前上下文资源计数', unit: 'count', query: available, tone: 'warning' },
  ]
}

/** Query resolution in seconds for the current range: ~120 points, never below 15s. */
export function queryStep(rangeMs: number): number {
  return Math.max(15, Math.ceil(rangeMs / 1000 / 120))
}

/** Convert a Prometheus `query_range` matrix response into chart series. */
export function resultSeries(response: unknown, definition: QueryDefinition): SeriesState[] {
  if (!response || typeof response !== 'object') return []
  const data = (response as Record<string, unknown>).data
  if (!data || typeof data !== 'object' || !Array.isArray((data as Record<string, unknown>).result)) return []
  const result = (data as Record<string, unknown>).result as unknown[]
  return result
    .map((entry, index) => {
      const item = entry as Record<string, unknown>
      const metric = item.metric && typeof item.metric === 'object' ? (item.metric as Record<string, unknown>) : {}
      const identity = ['pod', 'container', 'job', 'instance'].map((key) => metric[key]).find(Boolean)
      const hasLegendTemplate = definition.name.includes('{{')
      const resolvedLegend = definition.name.replace(/\{\{([^}]+)\}\}/g, (_match, key: string) => String(metric[key] ?? ''))
      const name = hasLegendTemplate
        ? resolvedLegend || String(identity || definition.name)
        : result.length > 1 && identity
          ? `${resolvedLegend} · ${String(identity)}`
          : result.length > 1
            ? `${resolvedLegend} ${index + 1}`
            : resolvedLegend
      const values = Array.isArray(item.values)
        ? item.values.flatMap((point) => {
            if (!Array.isArray(point) || point.length < 2) return []
            const timestamp = Number(point[0]) * 1000
            const value = Number(point[1])
            return Number.isFinite(timestamp) && Number.isFinite(value) ? [[timestamp, value] as [number, number]] : []
          })
        : []
      return { name, color: result.length === 1 ? definition.color : undefined, values }
    })
    .filter((series) => series.values.length)
}

/** Read a single value out of an instant query or the last sample of a range query. */
export function instantValue(response: unknown): number | null {
  if (!response || typeof response !== 'object') return null
  const data = (response as Record<string, unknown>).data
  if (!data || typeof data !== 'object' || !Array.isArray((data as Record<string, unknown>).result)) return null
  const result = (data as Record<string, unknown>).result as unknown[]
  if (!result.length) return null
  const first = result[0] as Record<string, unknown>
  const raw = Array.isArray(first.value)
    ? first.value[1]
    : Array.isArray(first.values)
      ? (first.values.at(-1) as unknown[] | undefined)?.[1]
      : undefined
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

export interface TableResult {
  rows: Array<Record<string, unknown>>
  columns: string[]
}

/**
 * Merge table panel responses into rows: each Prometheus result becomes a row
 * keyed by its label set, with `Value #<ref>` columns renamed through the
 * panel's style aliases.
 */
export function tableFromResponses(responses: unknown[], targets: DashboardTarget[], styles: DashboardTableStyle[]): TableResult {
  const rows: Array<Record<string, unknown>> = []
  const grouped = new Map<string, Record<string, unknown>>()
  responses.forEach((response, index) => {
    const data = (response as Record<string, any>)?.data
    const result = Array.isArray(data?.result) ? data.result : []
    const target = targets[index]!
    const valueStyle = styles.find((item) => item.pattern === `Value #${target.ref}`)
    for (const sample of result) {
      const metric = (sample?.metric || {}) as Record<string, unknown>
      const value = Array.isArray(sample?.value)
        ? sample.value[1]
        : Array.isArray(sample?.values)
          ? (sample.values.at(-1) as unknown[] | undefined)?.[1]
          : undefined
      const key = JSON.stringify(metric)
      const row = grouped.get(key) || {}
      Object.entries(metric).forEach(([name, labelValue]) => {
        row[name] = labelValue
        const labelStyle = styles.find((item) => item.pattern === name)
        if (labelStyle) row[labelStyle.alias] = labelValue
      })
      row[valueStyle?.alias || target.ref] = value
      grouped.set(key, row)
    }
  })
  rows.push(...grouped.values())
  const columns = styles.length
    ? styles.map((style) => style.alias)
    : [
        ...new Set(rows.flatMap((item) => Object.keys(item).filter((key) => !targets.some((target) => target.ref === key)))),
        ...targets.map((target) => target.ref),
      ]
  return { rows, columns }
}
