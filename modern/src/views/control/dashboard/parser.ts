/**
 * Pure parsing helpers for KubeCube Dashboard CRs.
 *
 * Everything in this module takes explicit inputs and returns plain values so it
 * can be unit tested without a Vue component, a router or a browser. The
 * DashboardView component keeps only reactive state and API orchestration.
 */

export type ContextKind = 'namespace' | 'workload' | 'cluster' | 'component'
export type ChartKey = 'cpu' | 'memory' | 'network' | 'capacity'
export type MetricKey = 'cpu' | 'memory' | 'network' | 'available'
export type UnitKind = 'cpu' | 'memory' | 'bytesPerSecond' | 'requestsPerSecond' | 'count' | 'fileDescriptors' | 'percent' | 'seconds'

export interface QueryDefinition {
  name: string
  query: string
  color: string
}

export interface ChartDefinition {
  key: ChartKey
  title: string
  description: string
  footer: string
  unit: UnitKind
  queries: QueryDefinition[]
}

export interface SeriesState {
  name: string
  color?: string
  values: [number, number][]
}

export interface ChartState {
  series: SeriesState[]
  loading: boolean
  error: string
}

export interface MetricState {
  value: number | null
  error: string
}

export interface MetricDefinition {
  key: MetricKey
  label: string
  caption: string
  unit: UnitKind
  query: string
  tone: 'brand' | 'success' | 'warning' | 'info'
}

export interface DashboardTarget {
  name: string
  query: string
  legend: string
  ref: string
  instant: boolean
}

export interface DashboardVariable {
  name: string
  label: string
  request: string
  includeAll: boolean
  options?: string[]
}

export interface DashboardTableStyle {
  alias: string
  pattern: string
  unit: UnitKind
  link: boolean
  linkUrl: string
}

export interface DynamicPanel {
  id: string
  type: 'graph' | 'table' | 'singleStat'
  title: string
  span: number
  unit: UnitKind
  targets: DashboardTarget[]
  state: ChartState
  tableRows: Array<Record<string, unknown>>
  tableColumns: string[]
  tableStyles: DashboardTableStyle[]
  tableUnits: Record<string, UnitKind>
  stats: Array<{ name: string; value: number | null }>
  stack: boolean
  axisMin?: number
  axisMax?: number
  linkUrl: string
}

export interface DynamicRow {
  name: string
  panels: DynamicPanel[]
}

export interface DashboardSpec {
  title?: string
  selectshowable?: string | boolean
  variables?: Array<Record<string, any>>
  rows?: Array<Record<string, any>>
}

export interface DashboardContextInput {
  tenant: string
  project: string
  cluster: string
  namespace: string
  instance: string
  workload: string
  node: string
  variables: Record<string, string>
}

export interface LabelValuesRequest {
  metric: string
  label: string
}

export function createChartStates(): Record<ChartKey, ChartState> {
  return {
    cpu: { series: [], loading: false, error: '' },
    memory: { series: [], loading: false, error: '' },
    network: { series: [], loading: false, error: '' },
    capacity: { series: [], loading: false, error: '' },
  }
}

export function createMetricStates(): Record<MetricKey, MetricState> {
  return {
    cpu: { value: null, error: '' },
    memory: { value: null, error: '' },
    network: { value: null, error: '' },
    available: { value: null, error: '' },
  }
}

export function normalizeUnit(value: unknown): UnitKind {
  const unit = String(value || '')
  if (['percentunit', 'percent', '%'].includes(unit)) return 'percent'
  if (['byte', 'bytes', 'decbytes'].includes(unit)) return 'memory'
  if (['Bps', 'binBps', 'decBps'].includes(unit)) return 'bytesPerSecond'
  if (['pps', 'ops', 'reqps'].includes(unit)) return 'requestsPerSecond'
  if (['cores', 'cpu'].includes(unit)) return 'cpu'
  if (['s', 'seconds'].includes(unit)) return 'seconds'
  return 'count'
}

/**
 * Resolve the template values used by `applyVariables`. The keys mirror the
 * labels KubeCube dashboards reference, plus the current Dashboard variables.
 */
export function buildDashboardContextValues(input: DashboardContextInput): Record<string, string> {
  return {
    tenant: input.tenant,
    project: input.project,
    cluster: input.cluster,
    namespace: input.namespace,
    workload: input.instance,
    pod: input.instance,
    volume: input.instance,
    type: input.workload.replace(/s$/, ''),
    node: input.node,
    ...input.variables,
  }
}

/** Replace `[[name]]`, `${name}` and `$name` placeholders; unknown names become empty strings. */
export function applyVariables(template: string, values: Record<string, string>, extra: Record<string, string> = {}): string {
  const merged = { ...values, ...extra }
  return String(template || '').replace(
    /\[\[([A-Za-z0-9_]+)\]\]|\$\{([A-Za-z0-9_]+)\}|\$([A-Za-z0-9_]+)/g,
    (_match, bracket: string, braced: string, dollar: string) => merged[bracket || braced || dollar] ?? '',
  )
}

/** Parse `spec.variables` into the values the toolbar renders. */
export function parseVariables(spec: DashboardSpec): DashboardVariable[] {
  return (spec.variables || [])
    .map((item) => {
      const query = (item.query || {}) as Record<string, unknown>
      return {
        name: String(query.name || item.name || ''),
        label: String(query.label || query.name || item.name || ''),
        request: String(query.request || ''),
        includeAll: query.includeAll === true || query.includeAll === 'true',
      }
    })
    .filter((item) => item.name)
}

/** Parse `spec.rows` into the panel model the view renders and queries. */
export function parseRows(spec: DashboardSpec): DynamicRow[] {
  return (spec.rows || []).map((row, rowIndex) => {
    const panels = (Array.isArray(row.panels) ? row.panels : []).flatMap((rawPanel, panelIndex) => {
      const entry = rawPanel as Record<string, any>
      const type = (['graph', 'table', 'singleStat'] as const).find((candidate) => entry[candidate])
      if (!type) return []
      const config = (entry[type] || {}) as Record<string, any>
      if (config.hidden) return []
      const targets = (Array.isArray(config.targets) ? config.targets : [])
        .map((target: Record<string, any>, targetIndex: number) => {
          const prometheus = (target.prometheus || {}) as Record<string, unknown>
          return {
            name: String(prometheus.legend || `序列 ${targetIndex + 1}`),
            query: String(prometheus.query || ''),
            legend: String(prometheus.legend || ''),
            ref: String(prometheus.ref || String.fromCharCode(65 + targetIndex)),
            instant: prometheus.instant === true || prometheus.instant === 'true',
          }
        })
        .filter((target: DashboardTarget) => target.query)
      return [
        {
          id: `row-${rowIndex}-panel-${panelIndex}`,
          type,
          title: String(config.title || (type === 'singleStat' ? '指标' : '监控图表')),
          span: Math.max(1, Math.min(12, Number(config.span) || (type === 'graph' ? 6 : type === 'table' ? 12 : 2))),
          unit: normalizeUnit(config.unit || config.axes?.left?.unit || config.axes?.y?.unit || config.styles?.[0]?.unit),
          targets,
          state: { series: [], loading: false, error: '' } as ChartState,
          tableRows: [] as Array<Record<string, unknown>>,
          tableColumns: [] as string[],
          tableStyles: (Array.isArray(config.styles) ? config.styles : [])
            .map((style: Record<string, any>) => ({
              alias: String(style.alias || ''),
              pattern: String(style.pattern || ''),
              unit: normalizeUnit(style.unit),
              link: Boolean(style.link),
              linkUrl: String(style.linkUrl || ''),
            }))
            .filter((style: { alias: string }) => style.alias),
          tableUnits: Object.fromEntries(
            (Array.isArray(config.styles) ? config.styles : [])
              .filter((style: Record<string, any>) => style.alias)
              .map((style: Record<string, any>) => [String(style.alias), normalizeUnit(style.unit)]),
          ),
          stats: [] as Array<{ name: string; value: number | null }>,
          stack: Boolean(config.stack),
          axisMin: Number.isFinite(Number(config.axes?.left?.min)) ? Number(config.axes.left.min) : undefined,
          axisMax: Number.isFinite(Number(config.axes?.left?.max)) ? Number(config.axes.left.max) : undefined,
          linkUrl: String(config.linkUrl || ''),
        },
      ]
    })
    return { name: String(row.name || row.title || `监控区域 ${rowIndex + 1}`), panels: panels as DynamicPanel[] }
  })
}

/** Extract the metric and label from a `label_values(...)` variable request. */
export function parseLabelValuesRequest(request: string): LabelValuesRequest | null {
  const expression = String(request || '').match(/^label_values\((?:(.+),\s*)?([A-Za-z_][A-Za-z0-9_]*)\)\s*$/)
  if (!expression) return null
  const [, metric, label] = expression
  if (!label) return null
  return { metric: metric || '', label }
}

/** Extract the sorted, de-duplicated label values from a `/api/v1/series` response. */
export function seriesLabelValues(response: unknown, label: string): string[] {
  const root = response as Record<string, any>
  const list = Array.isArray(root.data) ? root.data : Array.isArray(root) ? root : []
  return [...new Set(list.map((item: Record<string, unknown>) => String(item[label] || '')).filter(Boolean))]
}

/** Extract the values from a `/api/v1/label/<label>/values` response. */
export function labelValues(response: unknown): string[] {
  const root = response as Record<string, any>
  const list = Array.isArray(root.data) ? root.data : Array.isArray(root.data?.data) ? root.data.data : []
  const values = (list as unknown[])
    .map((item: unknown) => (typeof item === 'string' ? item : String((item as Record<string, unknown>)?.value || '')))
    .filter((value: unknown): value is string => Boolean(value))
  return [...new Set<string>(values)]
}

/** Prepend the `.*` "all" option when the variable asks for it. */
export function buildVariableOptions(loaded: string[], includeAll: boolean): string[] {
  return includeAll && !loaded.includes('.*') ? ['.*', ...loaded] : loaded
}

/** Pick the variable value to preselect from the current context and loaded options. */
export function selectVariableValue(options: string[], contextValue: string, includeAll: boolean): string {
  return options.includes(contextValue)
    ? contextValue
    : options.find((option) => option !== '.*') || (includeAll ? '.*' : '') || contextValue
}

/** Keep only rows that still have at least one visible panel. */
export function visibleRows(rows: DynamicRow[], panelVisibility: Record<string, boolean>): DynamicRow[] {
  return rows
    .map((row) => ({ ...row, panels: row.panels.filter((panel) => panelVisibility[panel.id] !== false) }))
    .filter((row) => row.panels.length)
}

/** Whether any parsed row carries a renderable panel. */
export function hasDashboardRows(rows: DynamicRow[]): boolean {
  return rows.some((row) => row.panels.length > 0)
}
