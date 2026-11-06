<template>
  <div class="page page-stack dashboard-page">
    <PageHeader :title="pageTitle" :description="pageDescription" :breadcrumbs="breadcrumbs">
      <template #actions>
        <el-button :icon="Refresh" :loading="loading" :disabled="!targetCluster" @click="loadMonitoring">立即刷新</el-button>
      </template>
    </PageHeader>

    <section class="context-strip surface" aria-label="监控对象上下文">
      <div v-for="item in contextItems" :key="item.label" class="context-entry">
        <span>{{ item.label }}</span
        ><strong :title="item.value">{{ item.value }}</strong>
      </div>
      <div class="update-status">
        <span class="live-dot" :class="{ 'live-dot--busy': loading }" />{{
          loading ? '正在更新' : lastUpdated ? `更新于 ${formatDate(lastUpdated, true)}` : '尚未更新'
        }}
      </div>
    </section>

    <section class="monitor-toolbar surface">
      <div class="toolbar-field toolbar-field--range">
        <span class="toolbar-label">时间范围</span>
        <el-radio-group v-model="rangeMs" aria-label="监控时间范围">
          <el-radio-button v-for="option in rangeOptions" :key="option.value" :value="option.value">{{ option.label }}</el-radio-button>
        </el-radio-group>
      </div>
      <div class="toolbar-field">
        <span class="toolbar-label">自动刷新</span>
        <el-select v-model="autoRefreshMs" class="refresh-select" aria-label="自动刷新间隔">
          <el-option v-for="option in refreshOptions" :key="option.value" :label="option.label" :value="option.value" />
        </el-select>
      </div>
      <span class="toolbar-hint">后台标签页暂停自动请求</span>
      <el-button v-if="selectShowable" class="dimension-button" @click="dimensionDialogOpen = true">维度选择</el-button>
    </section>

    <el-alert v-if="loadError" type="error" show-icon :closable="false" :title="loadError">
      <template #default><el-button link type="primary" :disabled="loading" @click="loadMonitoring">重试失败指标</el-button></template>
    </el-alert>
    <el-alert v-if="dashboardNotice && !hasDashboard" type="info" show-icon :closable="false" :title="dashboardNotice" />

    <EmptyState
      v-if="!targetCluster"
      class="surface"
      title="缺少集群上下文"
      description="请从集群或空间页面进入监控，并确保路由中包含有效的集群信息。"
    />
    <template v-else>
      <template v-if="hasDashboard">
        <section v-if="dashboardVariables.length" class="dashboard-variables surface">
          <label v-for="variable in dashboardVariables" :key="variable.name" class="dashboard-variable">
            <span>{{ variable.label || variable.name }}</span>
            <el-select
              v-model="dashboardVariableValues[variable.name]"
              filterable
              :placeholder="`选择${variable.label || variable.name}`"
              @change="loadMonitoring"
            >
              <el-option v-for="option in variable.options || []" :key="option" :label="option" :value="option" />
            </el-select>
          </label>
          <span class="variable-hint">Dashboard 变量会替换面板中的 PromQL 模板</span>
        </section>
        <section v-for="row in visibleRows" :key="row.name" class="dashboard-row">
          <header class="dashboard-row__header">
            <h2>{{ row.name }}</h2>
            <span>{{ row.panels.length }} 个面板</span>
          </header>
          <div class="dashboard-grid">
            <article
              v-for="panel in row.panels"
              :key="panel.id"
              class="dashboard-panel surface"
              :style="{ gridColumn: `span ${panel.span}` }"
            >
              <header class="dashboard-panel__header">
                <div>
                  <h3>{{ panel.title }}</h3>
                  <p>{{ panel.targets.length }} 个查询 · {{ panel.type }}</p>
                </div>
                <span v-if="panel.state.error" class="stale-badge">更新失败</span>
              </header>
              <div v-if="panel.type === 'graph'" class="chart-container">
                <div :ref="(element) => setDynamicChartRef(panel.id, element)" class="chart-element" role="img" :aria-label="panel.title" />
                <div v-if="!panel.state.loading && !panel.state.series.length" class="chart-empty">
                  <el-icon><DataAnalysis /></el-icon><strong>{{ panel.state.error ? '图表暂时不可用' : '暂无监控数据' }}</strong>
                </div>
              </div>
              <el-table
                v-else-if="panel.type === 'table'"
                :data="panel.tableRows"
                size="small"
                v-loading="panel.state.loading"
                max-height="360"
              >
                <el-table-column
                  v-for="column in panel.tableColumns"
                  :key="column"
                  :label="tableColumnLabel(panel, column)"
                  min-width="120"
                >
                  <template #default="{ row }">{{ tableCell(panel, column, row) }}</template>
                </el-table-column>
                <template #empty
                  ><div class="panel-empty">{{ panel.state.error || '暂无表格数据' }}</div></template
                >
              </el-table>
              <div v-else class="stat-list" v-loading="panel.state.loading">
                <div v-for="stat in panel.stats" :key="stat.name" class="stat-entry">
                  <span>{{ stat.name }}</span
                  ><strong
                    >{{ formatPanelValue(stat.value, panel.unit).value
                    }}<small>{{ formatPanelValue(stat.value, panel.unit).unit }}</small></strong
                  >
                </div>
                <div v-if="!panel.stats.length && !panel.state.loading" class="panel-empty">{{ panel.state.error || '暂无指标数据' }}</div>
              </div>
              <footer class="dashboard-panel__footer">
                <span>{{ applyVariables(panel.targets[0]?.query || '') }}</span
                ><span>{{ panel.state.error ? '请求失败，保留上次数据' : panel.state.loading ? '加载中' : '已更新' }}</span>
              </footer>
            </article>
          </div>
        </section>
      </template>
      <template v-else>
        <div class="metrics-grid">
          <MetricCard
            v-for="metric in metricCards"
            :key="metric.key"
            :label="metric.label"
            :value="metric.value"
            :unit="metric.unit"
            :caption="metric.error ? '更新失败，展示上一次结果' : metric.caption"
            :loading="metric.loading"
            :tone="metric.tone"
          >
            <template #icon
              ><el-icon><component :is="metric.icon" /></el-icon
            ></template>
          </MetricCard>
        </div>

        <div class="chart-grid">
          <section v-for="definition in chartDefinitions" :key="definition.key" class="chart-card surface">
            <header class="chart-card__header">
              <div>
                <h2>{{ definition.title }}</h2>
                <p>{{ definition.description }}</p>
              </div>
              <span v-if="chartStates[definition.key].error && chartStates[definition.key].series.length" class="stale-badge"
                >上次数据</span
              >
            </header>
            <div class="chart-container" v-loading="chartStates[definition.key].loading && !chartStates[definition.key].series.length">
              <div
                :ref="(element) => setChartRef(definition.key, element)"
                class="chart-element"
                role="img"
                :aria-label="definition.title"
              />
              <div v-if="!chartStates[definition.key].loading && !chartStates[definition.key].series.length" class="chart-empty">
                <el-icon><DataAnalysis /></el-icon>
                <strong>{{ chartStates[definition.key].error ? '图表暂时不可用' : '暂无监控数据' }}</strong>
                <span>{{ chartStates[definition.key].error ? '请求失败，请稍后重试' : '当前对象与时间范围内没有可展示的指标' }}</span>
              </div>
            </div>
            <footer class="chart-card__footer">
              <span>{{ definition.footer }}</span
              ><span>{{ chartStates[definition.key].series.length }} 条曲线</span>
            </footer>
          </section>
        </div>
      </template>
    </template>
    <el-dialog v-model="dimensionDialogOpen" title="维度选择" width="620px">
      <div v-for="row in dashboardRows" :key="row.name" class="dimension-group">
        <h4>{{ row.name }}</h4>
        <div class="dimension-options">
          <el-checkbox v-for="panel in row.panels" :key="panel.id" v-model="panelVisibility[panel.id]">{{ panel.title }}</el-checkbox>
        </div>
      </div>
      <template #footer
        ><el-button @click="dimensionDialogOpen = false">取消</el-button
        ><el-button type="primary" @click="dimensionDialogOpen = false">确定</el-button></template
      >
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type ComponentPublicInstance } from 'vue'
import { useRoute } from 'vue-router'
import * as echarts from 'echarts'
import type { ECharts, EChartsOption, LineSeriesOption } from 'echarts'
import { Coin, Connection, Cpu, DataAnalysis, Odometer, Refresh } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import MetricCard from '@/components/MetricCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import { monitorApi } from '@/api/observability'
import { getResourceConfig } from '@/config/resources'
import { useScopeStore } from '@/stores/scope'
import { formatBytes, formatDate, formatNumber } from '@/utils/format'

type ContextKind = 'namespace' | 'workload' | 'cluster' | 'component'
type ChartKey = 'cpu' | 'memory' | 'network' | 'capacity'
type MetricKey = 'cpu' | 'memory' | 'network' | 'available'
type UnitKind = 'cpu' | 'memory' | 'bytesPerSecond' | 'requestsPerSecond' | 'count' | 'fileDescriptors' | 'percent'
interface QueryDefinition {
  name: string
  query: string
  color: string
}
interface ChartDefinition {
  key: ChartKey
  title: string
  description: string
  footer: string
  unit: UnitKind
  queries: QueryDefinition[]
}
interface SeriesState {
  name: string
  color?: string
  values: [number, number][]
}
interface ChartState {
  series: SeriesState[]
  loading: boolean
  error: string
}
interface MetricState {
  value: number | null
  error: string
}
interface MetricDefinition {
  key: MetricKey
  label: string
  caption: string
  unit: UnitKind
  query: string
  tone: 'brand' | 'success' | 'warning' | 'info'
}
interface DashboardTarget {
  name: string
  query: string
  legend: string
}
interface DashboardVariable {
  name: string
  label: string
  request: string
  options?: string[]
}
interface DynamicPanel {
  id: string
  type: 'graph' | 'table' | 'singleStat'
  title: string
  span: number
  unit: UnitKind
  targets: DashboardTarget[]
  state: ChartState
  tableRows: Array<Record<string, unknown>>
  tableColumns: string[]
  tableStyles: Array<{ alias: string; pattern: string; unit: UnitKind }>
  tableUnits: Record<string, UnitKind>
  stats: Array<{ name: string; value: number | null }>
}
interface DynamicRow {
  name: string
  panels: DynamicPanel[]
}
interface DashboardSpec {
  title?: string
  selectshowable?: string | boolean
  variables?: Array<Record<string, any>>
  rows?: Array<Record<string, any>>
}

const route = useRoute()
const scope = useScopeStore()
const rangeOptions = [
  { label: '15 分钟', value: 15 * 60_000 },
  { label: '30 分钟', value: 30 * 60_000 },
  { label: '1 小时', value: 60 * 60_000 },
  { label: '6 小时', value: 6 * 60 * 60_000 },
  { label: '24 小时', value: 24 * 60 * 60_000 },
  { label: '7 天', value: 7 * 24 * 60 * 60_000 },
]
const refreshOptions = [
  { label: '关闭', value: 0 },
  { label: '15 秒', value: 15_000 },
  { label: '30 秒', value: 30_000 },
  { label: '1 分钟', value: 60_000 },
  { label: '5 分钟', value: 300_000 },
]
const rangeMs = ref(60 * 60_000)
const autoRefreshMs = ref(0)
const loading = ref(false)
const loadError = ref('')
const lastUpdated = ref<number>()
const chartStates = ref<Record<ChartKey, ChartState>>(createChartStates())
const metricStates = ref<Record<MetricKey, MetricState>>(createMetricStates())
const chartElements = new Map<ChartKey, HTMLDivElement>()
const charts = new Map<ChartKey, ECharts>()
const dynamicElements = new Map<string, HTMLDivElement>()
const dynamicCharts = new Map<string, ECharts>()
const dashboardTitle = ref('')
const dashboardSpec = ref<DashboardSpec>()
const dashboardLoaded = ref(false)
const dashboardNotice = ref('')
const dashboardVariables = ref<DashboardVariable[]>([])
const dashboardVariableValues = ref<Record<string, string>>({})
const dashboardRows = ref<DynamicRow[]>([])
const panelVisibility = ref<Record<string, boolean>>({})
const dimensionDialogOpen = ref(false)
const selectShowable = computed(() => String(dashboardSpec.value?.selectshowable || '') === 'true')
const visibleRows = computed(() =>
  dashboardRows.value
    .map((row) => ({ ...row, panels: row.panels.filter((panel) => panelVisibility.value[panel.id] !== false) }))
    .filter((row) => row.panels.length),
)
const hasDashboard = computed(() => dashboardRows.value.some((row) => row.panels.length > 0))
let resizeObserver: ResizeObserver | undefined
let refreshTimer: number | undefined
let mounted = false
let requestId = 0

const contextKind = computed<ContextKind>(() => {
  if (route.name === 'platform.monitor.dashboard') return 'component'
  if (route.path.startsWith('/platform/cluster/')) return 'cluster'
  if (route.params.workload && route.params.instance) return 'workload'
  return 'namespace'
})
const routeCluster = computed(() => (typeof route.query.cluster === 'string' ? route.query.cluster : ''))
const targetCluster = computed(() => {
  if (contextKind.value === 'cluster' && typeof route.params.name === 'string') return route.params.name
  return routeCluster.value || scope.cluster || scope.controlCluster
})
const workload = computed(() => (typeof route.params.workload === 'string' ? route.params.workload : ''))
const instanceName = computed(() => (typeof route.params.instance === 'string' ? route.params.instance : ''))
const componentName = computed(() => (typeof route.params.dashboard === 'string' ? route.params.dashboard : ''))
const nodeName = computed(() => (typeof route.params.nodename === 'string' ? route.params.nodename : ''))
const clusterName = computed(() => {
  if (contextKind.value === 'cluster' && typeof route.params.name === 'string') return route.params.name
  return targetCluster.value
})
const contextKey = computed(() =>
  [contextKind.value, targetCluster.value, scope.namespace, workload.value, instanceName.value, componentName.value, nodeName.value].join(
    '|',
  ),
)
const workloadTitle = computed(() => getResourceConfig(workload.value)?.shortTitle || workload.value || '工作负载')
const pageTitle = computed(() => {
  if (dashboardTitle.value && hasDashboard.value) return dashboardTitle.value
  if (contextKind.value === 'component') return `${componentName.value || '平台组件'} · 组件监控`
  if (contextKind.value === 'cluster') return nodeName.value ? `${nodeName.value} · 节点监控` : `${clusterName.value} · 集群监控`
  if (contextKind.value === 'workload') return `${instanceName.value} · ${workloadTitle.value}监控`
  return `${scope.namespace || '当前空间'} · 资源监控`
})
const pageDescription = computed(() => {
  const descriptions: Record<ContextKind, string> = {
    namespace: '观察空间内容器 CPU、内存、网络与资源请求的变化趋势。',
    workload: '根据工作负载关联 Pod 聚合资源指标，辅助判断容量与运行状态。',
    cluster: '汇总集群节点资源、网络吞吐和可分配容量，快速定位容量瓶颈。',
    component: '跟踪平台组件进程资源、请求速率与健康状态，支持故障排查。',
  }
  return descriptions[contextKind.value]
})
const breadcrumbs = computed(() => [
  route.path.startsWith('/platform') ? '平台管理' : '资源控制台',
  contextKind.value === 'component'
    ? '组件监控'
    : contextKind.value === 'cluster'
      ? '集群详情'
      : contextKind.value === 'workload'
        ? workloadTitle.value
        : '可观测性',
  '监控',
])
const dashboardResourceName = computed(() => {
  if (contextKind.value === 'component') return componentName.value || 'cube-component-resource'
  if (nodeName.value) return 'cube-resource-node'
  if (contextKind.value === 'cluster') return 'cube-resource-cluster'
  if (workload.value === 'pods') return 'cube-pod-resource'
  if (workload.value === 'persistentvolumeclaims') return 'cube-resource-persistent-volumes'
  if (workload.value) return 'cube-workload-resource'
  return 'cube-resource-namespace'
})
const contextItems = computed(() => {
  const items = [
    {
      label: '监控对象',
      value:
        (
          {
            namespace: '命名空间',
            workload: workloadTitle.value,
            cluster: nodeName.value ? '集群节点' : '集群',
            component: '平台组件',
          } as Record<string, string>
        )[contextKind.value] || '资源',
    },
    { label: '集群', value: targetCluster.value || '未选择' },
  ]
  if (!route.path.startsWith('/platform'))
    items.unshift({ label: '租户 / 项目', value: `${scope.tenant || '—'} / ${scope.project || '—'}` })
  if (contextKind.value === 'namespace' || contextKind.value === 'workload')
    items.push({ label: '空间', value: scope.namespace || '未选择' })
  if (contextKind.value === 'workload') items.push({ label: '实例', value: instanceName.value })
  if (contextKind.value === 'component') items.push({ label: '组件面板', value: componentName.value || '未指定' })
  if (nodeName.value) items.push({ label: '节点', value: nodeName.value })
  return items
})

function createChartStates(): Record<ChartKey, ChartState> {
  return {
    cpu: { series: [], loading: false, error: '' },
    memory: { series: [], loading: false, error: '' },
    network: { series: [], loading: false, error: '' },
    capacity: { series: [], loading: false, error: '' },
  }
}
function createMetricStates(): Record<MetricKey, MetricState> {
  return {
    cpu: { value: null, error: '' },
    memory: { value: null, error: '' },
    network: { value: null, error: '' },
    available: { value: null, error: '' },
  }
}
function normalizeUnit(value: unknown): UnitKind {
  const unit = String(value || '')
  if (['percentunit', 'percent'].includes(unit)) return 'percent'
  if (['bytes', 'decbytes'].includes(unit)) return 'memory'
  if (['Bps', 'binBps'].includes(unit)) return 'bytesPerSecond'
  if (['pps', 'ops'].includes(unit)) return 'requestsPerSecond'
  if (['cores', 'cpu'].includes(unit)) return 'cpu'
  return 'count'
}
function applyVariables(template: string): string {
  return String(template || '').replace(
    /\[\[([A-Za-z0-9_]+)\]\]|\$([A-Za-z0-9_]+)/g,
    (_match, bracket: string, dollar: string) => dashboardVariableValues.value[bracket || dollar] ?? '',
  )
}
function parseVariables(spec: DashboardSpec): DashboardVariable[] {
  return (spec.variables || [])
    .map((item) => {
      const query = (item.query || {}) as Record<string, unknown>
      return {
        name: String(query.name || item.name || ''),
        label: String(query.label || query.name || item.name || ''),
        request: String(query.request || ''),
      }
    })
    .filter((item) => item.name)
}
function parseRows(spec: DashboardSpec): DynamicRow[] {
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
          }
        })
        .filter((target: DashboardTarget) => target.query)
      return [
        {
          id: `row-${rowIndex}-panel-${panelIndex}`,
          type,
          title: String(config.title || (type === 'singleStat' ? '指标' : '监控图表')),
          span: Math.max(1, Math.min(12, Number(config.span) || (type === 'graph' ? 6 : type === 'table' ? 12 : 2))),
          unit: normalizeUnit(config.unit || config.axes?.y?.unit || config.styles?.[0]?.unit),
          targets,
          state: { series: [], loading: false, error: '' } as ChartState,
          tableRows: [] as Array<Record<string, unknown>>,
          tableColumns: [] as string[],
          tableStyles: (Array.isArray(config.styles) ? config.styles : [])
            .map((style: Record<string, any>) => ({
              alias: String(style.alias || ''),
              pattern: String(style.pattern || ''),
              unit: normalizeUnit(style.unit),
            }))
            .filter((style: { alias: string }) => style.alias),
          tableUnits: Object.fromEntries(
            (Array.isArray(config.styles) ? config.styles : [])
              .filter((style: Record<string, any>) => style.alias)
              .map((style: Record<string, any>) => [String(style.alias), normalizeUnit(style.unit)]),
          ),
          stats: [] as Array<{ name: string; value: number | null }>,
        },
      ]
    })
    return { name: String(row.name || row.title || `监控区域 ${rowIndex + 1}`), panels: panels as DynamicPanel[] }
  })
}
async function resolveVariableOptions(variable: DashboardVariable): Promise<string[]> {
  const expression = variable.request.match(/^label_values\((?:(.+),\s*)?([A-Za-z_][A-Za-z0-9_]*)\)\s*$/)
  if (!expression) return []
  const [, metric, label] = expression
  const end = Math.floor(Date.now() / 1000)
  const start = end - Math.floor(rangeMs.value / 1000)
  try {
    if (metric) {
      const response = await monitorApi.series({ 'match[]': applyVariables(metric), start, end })
      const root = response as Record<string, any>
      const list = Array.isArray(root.data) ? root.data : Array.isArray(root) ? root : []
      return [...new Set(list.map((item: Record<string, unknown>) => String(item[label!] || '')).filter(Boolean))]
    }
    const response = await monitorApi.labels(label!, { start, end })
    const root = response as Record<string, any>
    const list = Array.isArray(root.data) ? root.data : Array.isArray(root.data?.data) ? root.data.data : []
    const values = (list as unknown[])
      .map((item: unknown) => (typeof item === 'string' ? item : String((item as Record<string, unknown>)?.value || '')))
      .filter((value: unknown): value is string => Boolean(value))
    return [...new Set<string>(values)]
  } catch {
    return []
  }
}
async function loadDashboardDefinition() {
  const expectedContext = contextKey.value
  dashboardLoaded.value = true
  dashboardNotice.value = ''
  dashboardTitle.value = ''
  dashboardVariables.value = []
  dashboardVariableValues.value = {}
  dashboardRows.value = []
  const controlCluster = scope.controlCluster || targetCluster.value
  if (!controlCluster) return
  try {
    const response = (await monitorApi.dashboard(controlCluster, dashboardResourceName.value)) as Record<string, any>
    if (expectedContext !== contextKey.value) return
    const spec = (response.spec || response) as DashboardSpec
    const rows = parseRows(spec)
    if (!rows.some((row) => row.panels.length)) {
      dashboardNotice.value = '当前对象没有可用的 Dashboard 面板，已切换到内置指标视图。'
      return
    }
    dashboardSpec.value = spec
    dashboardTitle.value = String(spec.title || '')
    dashboardVariables.value = parseVariables(spec)
    for (const variable of dashboardVariables.value) {
      const options = await resolveVariableOptions(variable)
      if (expectedContext !== contextKey.value) return
      dashboardVariableValues.value[variable.name] = options[0] || ''
      variable.options = options
    }
    dashboardRows.value = rows
    panelVisibility.value = Object.fromEntries(rows.flatMap((row) => row.panels.map((panel) => [panel.id, true])))
  } catch {
    if (expectedContext === contextKey.value)
      dashboardNotice.value = 'Dashboard 定义暂不可用，已使用内置指标视图；接口恢复后刷新即可加载完整面板。'
  }
}
async function loadDynamicMonitoring() {
  if (!hasDashboard.value) return
  const current = ++requestId
  const end = Math.floor(Date.now() / 1000)
  const start = end - Math.floor(rangeMs.value / 1000)
  const step = queryStep()
  loading.value = true
  loadError.value = ''
  const failures: string[] = []
  let successes = 0
  await Promise.all(
    dashboardRows.value.flatMap((row) =>
      row.panels.map(async (panel) => {
        panel.state.loading = true
        panel.state.error = ''
        try {
          if (panel.type === 'graph') {
            const responses = await Promise.all(
              panel.targets.map((target) => monitorApi.queryRange({ query: applyVariables(target.query), start, end, step })),
            )
            if (current !== requestId) return
            const series = responses.flatMap((response, index) =>
              resultSeries(response, {
                name: panel.targets[index]!.name,
                query: applyVariables(panel.targets[index]!.query),
                color: ['#5b6cff', '#12b76a', '#2e90fa', '#f79009', '#7a5af8', '#f04438'][index % 6]!,
              }),
            )
            panel.state = { series, loading: false, error: '' }
            successes++
            await nextTick()
            renderDynamicChart(panel)
          } else if (panel.type === 'table') {
            const responses = await Promise.all(
              panel.targets.map((target) => monitorApi.query({ query: applyVariables(target.query), time: end })),
            )
            if (current !== requestId) return
            const rows: Array<Record<string, unknown>> = []
            const grouped = new Map<string, Record<string, unknown>>()
            const styles = panel.tableStyles
            responses.forEach((response, index) => {
              const data = (response as Record<string, any>)?.data
              const result = Array.isArray(data?.result) ? data.result : []
              const style = styles.find((item) => item.pattern === `Value #${String.fromCharCode(65 + index)}`)
              for (const sample of result) {
                const metric = (sample?.metric || {}) as Record<string, unknown>
                const value = Array.isArray(sample?.value) ? sample.value[1] : undefined
                const key = JSON.stringify(metric)
                const row = grouped.get(key) || { ...metric, __target: panel.targets[index]?.name || `序列 ${index + 1}` }
                if (style) row[style.alias] = value
                else row.__value = value
                grouped.set(key, row)
              }
            })
            rows.push(...grouped.values())
            const columns = styles.length
              ? ['__target', ...styles.map((style) => style.alias)]
              : [
                  '__target',
                  ...new Set(
                    rows.flatMap((item) => Object.keys(item).filter((key) => key !== '__target' && key !== '__value' && key !== '__name')),
                  ),
                  '__value',
                ]
            panel.tableRows = rows
            panel.tableColumns = columns
            panel.state.loading = false
            successes++
          } else {
            const responses = await Promise.all(
              panel.targets.map((target) => monitorApi.query({ query: applyVariables(target.query), time: end })),
            )
            if (current !== requestId) return
            panel.stats = responses.map((response, index) => ({
              name: panel.targets[index]?.name || `指标 ${index + 1}`,
              value: instantValue(response),
            }))
            panel.state.loading = false
            successes++
          }
        } catch (error) {
          if (current !== requestId) return
          panel.state.loading = false
          panel.state.error = errorText(error)
          failures.push(`${panel.title}：${errorText(error)}`)
        }
      }),
    ),
  )
  if (current !== requestId) return
  loading.value = false
  if (successes) lastUpdated.value = Date.now()
  if (failures.length) loadError.value = `部分 Dashboard 面板更新失败，已有数据保持不变。${[...new Set(failures)].join('；')}`
}
function clearDynamicCharts() {
  dynamicCharts.forEach((chart) => chart.dispose())
  dynamicCharts.clear()
  dynamicElements.clear()
}
function setDynamicChartRef(id: string, element: Element | ComponentPublicInstance | null) {
  if (!(element instanceof HTMLDivElement)) return
  dynamicElements.set(id, element)
  if (mounted) {
    ensureDynamicChart(id)
    nextTick(() => renderDynamicChart(dashboardRows.value.flatMap((row) => row.panels).find((panel) => panel.id === id)))
  }
}
function ensureDynamicChart(id: string) {
  const element = dynamicElements.get(id)
  if (!element || dynamicCharts.has(id)) return
  const chart = echarts.init(element)
  dynamicCharts.set(id, chart)
  resizeObserver?.observe(element)
}
function renderDynamicChart(panel?: DynamicPanel) {
  if (!panel) return
  const chart = dynamicCharts.get(panel.id)
  if (!chart) return
  const definition: ChartDefinition = { key: 'cpu', title: panel.title, description: '', footer: '', unit: panel.unit, queries: [] }
  chart.setOption(chartOption(definition, panel.state), { notMerge: true })
}
function renderAllDynamicCharts() {
  dashboardRows.value
    .flatMap((row) => row.panels)
    .forEach((panel) => {
      if (panel.type === 'graph') {
        ensureDynamicChart(panel.id)
        renderDynamicChart(panel)
      }
    })
}
function formatPanelValue(value: number | null, unit: UnitKind) {
  return formatMetric(value, unit)
}
function tableColumnLabel(panel: DynamicPanel, column: string) {
  if (column === '__target') return '查询'
  if (column === '__value') return '值'
  return column
}
function tableCell(panel: DynamicPanel, column: string, row: Record<string, unknown>) {
  if (column === '__target') return row[column] ?? '—'
  const raw = row[column]
  if (raw === undefined || raw === null || raw === '') return '—'
  if (column === '__value' || panel.tableUnits[column]) {
    const value = Number(raw)
    return Number.isFinite(value) ? formatPanelValue(value, panel.tableUnits[column] || panel.unit).value : String(raw)
  }
  return String(raw)
}
function escapePrometheus(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}
function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
function baseLabels() {
  const labels = [`cluster="${escapePrometheus(targetCluster.value)}"`]
  if (contextKind.value === 'namespace' || contextKind.value === 'workload') labels.push(`namespace="${escapePrometheus(scope.namespace)}"`)
  if (contextKind.value === 'workload')
    labels.push(
      workload.value === 'pods' ? `pod="${escapePrometheus(instanceName.value)}"` : `pod=~"^${escapeRegex(instanceName.value)}(-.*)?$"`,
    )
  if (nodeName.value) labels.push(`instance=~"^${escapeRegex(nodeName.value)}(:.*)?$"`)
  return labels
}
function labels(...extra: string[]) {
  return `{${[...baseLabels(), ...extra].join(',')}}`
}
const chartDefinitions = computed<ChartDefinition[]>(() => {
  if (contextKind.value === 'cluster') {
    const cpu = `sum(rate(node_cpu_seconds_total${labels('mode!="idle"')}[5m]))`
    const memory = `sum(node_memory_MemTotal_bytes${labels()}) - sum(node_memory_MemAvailable_bytes${labels()})`
    const receive = `sum(rate(node_network_receive_bytes_total${labels('device!~"lo|veth.*|docker.*|cni.*|flannel.*"')}[5m]))`
    const transmit = `sum(rate(node_network_transmit_bytes_total${labels('device!~"lo|veth.*|docker.*|cni.*|flannel.*"')}[5m]))`
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
          { name: '总容量', query: `sum(kube_node_status_capacity${labels('resource="cpu"')})`, color: '#7a5af8' },
          { name: '可分配', query: `sum(kube_node_status_allocatable${labels('resource="cpu"')})`, color: '#12b76a' },
        ],
      },
    ]
  }
  if (contextKind.value === 'component') {
    return [
      {
        key: 'cpu',
        title: '进程 CPU 使用量',
        description: '组件进程 CPU 时间速率',
        footer: '单位：Core',
        unit: 'cpu',
        queries: [{ name: 'CPU 使用', query: `sum(rate(process_cpu_seconds_total${labels()}[5m]))`, color: '#5b6cff' }],
      },
      {
        key: 'memory',
        title: '进程常驻内存',
        description: '组件进程 Resident Set Size',
        footer: '单位：字节',
        unit: 'memory',
        queries: [{ name: '常驻内存', query: `sum(process_resident_memory_bytes${labels()})`, color: '#12b76a' }],
      },
      {
        key: 'network',
        title: '请求速率',
        description: 'HTTP 总请求与 5xx 请求',
        footer: '单位：请求 / 秒',
        unit: 'requestsPerSecond',
        queries: [
          { name: '全部请求', query: `sum(rate(http_requests_total${labels()}[5m]))`, color: '#2e90fa' },
          { name: '5xx 请求', query: `sum(rate(http_requests_total${labels('code=~"5.."')}[5m]))`, color: '#f04438' },
        ],
      },
      {
        key: 'capacity',
        title: '文件描述符',
        description: '进程已打开与最大文件描述符',
        footer: '单位：个',
        unit: 'fileDescriptors',
        queries: [
          { name: '已打开', query: `sum(process_open_fds${labels()})`, color: '#7a5af8' },
          { name: '最大值', query: `sum(process_max_fds${labels()})`, color: '#f79009' },
        ],
      },
    ]
  }
  const cpu = `sum(rate(container_cpu_usage_seconds_total${labels('container!=""', 'image!=""')}[5m]))`
  const memory = `sum(container_memory_working_set_bytes${labels('container!=""', 'image!=""')})`
  const receive = `sum(rate(container_network_receive_bytes_total${labels()}[5m]))`
  const transmit = `sum(rate(container_network_transmit_bytes_total${labels()}[5m]))`
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
        { name: 'Request', query: `sum(kube_pod_container_resource_requests${labels('resource="cpu"')})`, color: '#2e90fa' },
        { name: 'Limit', query: `sum(kube_pod_container_resource_limits${labels('resource="cpu"')})`, color: '#f79009' },
      ],
    },
  ]
})
const metricDefinitions = computed<MetricDefinition[]>(() => {
  const charts = chartDefinitions.value
  const cpu = charts.find((item) => item.key === 'cpu')!.queries[0]!.query
  const memory = charts.find((item) => item.key === 'memory')!.queries[0]!.query
  const networkQueries = charts.find((item) => item.key === 'network')!.queries
  const network =
    contextKind.value === 'component' ? networkQueries[0]!.query : `(${networkQueries[0]!.query}) + (${networkQueries[1]!.query})`
  const available =
    contextKind.value === 'cluster'
      ? `count(kube_node_info${labels()})`
      : contextKind.value === 'component'
        ? `sum(up${labels()})`
        : `count(kube_pod_info${labels()})`
  const availableLabel = contextKind.value === 'cluster' ? '节点数量' : contextKind.value === 'component' ? '健康组件实例' : '关联 Pods'
  return [
    { key: 'cpu', label: 'CPU 当前用量', caption: '最近瞬时查询', unit: 'cpu', query: cpu, tone: 'brand' },
    { key: 'memory', label: '内存当前用量', caption: '最近瞬时查询', unit: 'memory', query: memory, tone: 'success' },
    {
      key: 'network',
      label: contextKind.value === 'component' ? '当前请求速率' : '当前网络吞吐',
      caption: '接收与发送聚合',
      unit: contextKind.value === 'component' ? 'requestsPerSecond' : 'bytesPerSecond',
      query: network,
      tone: 'info',
    },
    { key: 'available', label: availableLabel, caption: '当前上下文资源计数', unit: 'count', query: available, tone: 'warning' },
  ]
})
const metricCards = computed(() =>
  metricDefinitions.value.map((definition) => {
    const state = metricStates.value[definition.key]
    const formatted = formatMetric(state.value, definition.unit)
    const icons = { cpu: Cpu, memory: Coin, network: Connection, available: Odometer }
    return { ...definition, ...formatted, error: state.error, loading: loading.value && state.value === null, icon: icons[definition.key] }
  }),
)

function formatMetric(value: number | null, unit: UnitKind): { value: string | number; unit: string } {
  if (value === null || !Number.isFinite(value)) return { value: '—', unit: '' }
  if (unit === 'cpu')
    return value > 0 && value < 1 ? { value: formatNumber(value * 1000), unit: 'mCore' } : { value: formatNumber(value), unit: 'Core' }
  if (unit === 'memory') return { value: formatBytes(value, 'B'), unit: '' }
  if (unit === 'bytesPerSecond') return { value: `${formatBytes(value, 'B')}/s`, unit: '' }
  if (unit === 'requestsPerSecond') return { value: formatNumber(value), unit: 'req/s' }
  if (unit === 'percent') return { value: formatNumber(value * 100, 1), unit: '%' }
  return { value: formatNumber(value), unit: '个' }
}
function axisValue(value: number, unit: UnitKind) {
  if (unit === 'memory') return formatBytes(value, 'B')
  if (unit === 'bytesPerSecond') return `${formatBytes(value, 'B')}/s`
  if (unit === 'cpu' && Math.abs(value) < 1) return `${formatNumber(value * 1000)}m`
  if (unit === 'percent') return `${formatNumber(value * 100, 1)}%`
  return formatNumber(value)
}
function errorText(error: unknown) {
  return error instanceof Error ? error.message : '请求失败，请稍后重试'
}
function queryStep() {
  return Math.max(15, Math.ceil(rangeMs.value / 1000 / 120))
}
function resultSeries(response: unknown, definition: QueryDefinition): SeriesState[] {
  if (!response || typeof response !== 'object') return []
  const data = (response as Record<string, unknown>).data
  if (!data || typeof data !== 'object' || !Array.isArray((data as Record<string, unknown>).result)) return []
  const result = (data as Record<string, unknown>).result as unknown[]
  return result
    .map((entry, index) => {
      const item = entry as Record<string, unknown>
      const metric = item.metric && typeof item.metric === 'object' ? (item.metric as Record<string, unknown>) : {}
      const identity = ['pod', 'container', 'job', 'instance'].map((key) => metric[key]).find(Boolean)
      const name =
        result.length > 1 && identity
          ? `${definition.name} · ${String(identity)}`
          : result.length > 1
            ? `${definition.name} ${index + 1}`
            : definition.name
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
function setChartRef(key: ChartKey, element: Element | ComponentPublicInstance | null) {
  if (!(element instanceof HTMLDivElement)) return
  chartElements.set(key, element)
  if (mounted) {
    ensureChart(key)
    nextTick(() => renderChart(key))
  }
}
function ensureChart(key: ChartKey) {
  const element = chartElements.get(key)
  if (!element || charts.has(key)) return
  const chart = echarts.init(element)
  charts.set(key, chart)
  resizeObserver?.observe(element)
}
function chartOption(definition: ChartDefinition, state: ChartState): EChartsOption {
  const palette = ['#5b6cff', '#12b76a', '#2e90fa', '#f79009', '#7a5af8', '#f04438']
  const series: LineSeriesOption[] = state.series.map((item, index) => ({
    name: item.name,
    type: 'line',
    data: item.values,
    smooth: true,
    showSymbol: false,
    connectNulls: false,
    lineStyle: { width: 2, color: item.color || palette[index % palette.length] },
    itemStyle: { color: item.color || palette[index % palette.length] },
    areaStyle: { opacity: state.series.length === 1 ? 0.12 : 0.05 },
    emphasis: { focus: 'series' },
  }))
  return {
    animation: false,
    color: palette,
    grid: { left: 18, right: 20, top: 44, bottom: 48, containLabel: true },
    legend: {
      type: 'scroll',
      top: 4,
      left: 0,
      icon: 'roundRect',
      itemWidth: 12,
      itemHeight: 4,
      textStyle: { color: '#667085', fontSize: 11 },
    },
    tooltip: {
      trigger: 'axis',
      confine: true,
      valueFormatter: (value) => (typeof value === 'number' ? axisValue(value, definition.unit) : String(value ?? '—')),
    },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: '#d0d5dd' } },
      axisLabel: { color: '#98a2b3', hideOverlap: true, formatter: '{HH}:{mm}' },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      min: (value) => Math.min(0, value.min),
      axisLabel: { color: '#98a2b3', formatter: (value: number) => axisValue(value, definition.unit) },
      splitLine: { lineStyle: { color: '#eaecf0', type: 'dashed' } },
    },
    series,
  }
}
function renderChart(key: ChartKey) {
  const chart = charts.get(key)
  const definition = chartDefinitions.value.find((item) => item.key === key)
  if (!chart || !definition) return
  chart.setOption(chartOption(definition, chartStates.value[key]), { notMerge: true })
}
function renderAllCharts() {
  chartDefinitions.value.forEach((definition) => {
    ensureChart(definition.key)
    renderChart(definition.key)
  })
}
function resetData() {
  loading.value = false
  chartStates.value = createChartStates()
  metricStates.value = createMetricStates()
  lastUpdated.value = undefined
  loadError.value = ''
  nextTick(renderAllCharts)
}
function resetDashboard() {
  dashboardLoaded.value = false
  dashboardTitle.value = ''
  dashboardNotice.value = ''
  dashboardSpec.value = undefined
  dashboardVariables.value = []
  dashboardVariableValues.value = {}
  dashboardRows.value = []
  clearDynamicCharts()
}
async function loadMonitoring() {
  if (!targetCluster.value) {
    loadError.value = '缺少集群上下文，无法查询监控数据。'
    return
  }
  if (!dashboardLoaded.value) await loadDashboardDefinition()
  if (hasDashboard.value) {
    await loadDynamicMonitoring()
    return
  }
  const current = ++requestId
  const definitions = chartDefinitions.value
  const metrics = metricDefinitions.value
  const end = Math.floor(Date.now() / 1000)
  const start = end - Math.floor(rangeMs.value / 1000)
  const step = queryStep()
  loading.value = true
  loadError.value = ''
  definitions.forEach((definition) => {
    chartStates.value[definition.key].loading = true
  })
  const failures: string[] = []
  let successCount = 0
  const chartTasks = definitions.map(async (definition) => {
    try {
      const responses = await Promise.all(
        definition.queries.map((query) => monitorApi.queryRange({ query: query.query, start, end, step })),
      )
      if (current !== requestId) return
      const series = responses.flatMap((response, index) => resultSeries(response, definition.queries[index]!))
      chartStates.value[definition.key] = { series, loading: false, error: '' }
      successCount++
      await nextTick()
      renderChart(definition.key)
    } catch (error) {
      if (current !== requestId) return
      chartStates.value[definition.key].loading = false
      chartStates.value[definition.key].error = errorText(error)
      failures.push(`${definition.title}：${errorText(error)}`)
    }
  })
  const metricTasks = metrics.map(async (definition) => {
    try {
      const response = await monitorApi.query({ query: definition.query, time: end })
      if (current !== requestId) return
      metricStates.value[definition.key] = { value: instantValue(response), error: '' }
      successCount++
    } catch (error) {
      if (current !== requestId) return
      metricStates.value[definition.key].error = errorText(error)
      failures.push(`${definition.label}：${errorText(error)}`)
    }
  })
  await Promise.all([...chartTasks, ...metricTasks])
  if (current !== requestId) return
  loading.value = false
  if (successCount) lastUpdated.value = Date.now()
  if (failures.length) loadError.value = `部分监控数据更新失败，已有图表和指标保持不变。${[...new Set(failures)].join('；')}`
}
function instantValue(response: unknown): number | null {
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
function resizeCharts() {
  charts.forEach((chart) => chart.resize())
  dynamicCharts.forEach((chart) => chart.resize())
}
function resetRefreshTimer() {
  if (refreshTimer !== undefined) window.clearInterval(refreshTimer)
  refreshTimer = undefined
  if (autoRefreshMs.value > 0)
    refreshTimer = window.setInterval(() => {
      if (!loading.value && !document.hidden && targetCluster.value) loadMonitoring()
    }, autoRefreshMs.value)
}
watch(autoRefreshMs, resetRefreshTimer)
watch(rangeMs, () => {
  if (mounted && targetCluster.value) loadMonitoring()
})
watch(contextKey, (value, previous) => {
  if (!mounted || value === previous) return
  requestId++
  resetDashboard()
  resetData()
  loadMonitoring()
})
onMounted(async () => {
  mounted = true
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        chartDefinitions.value.forEach((definition) => {
          if (chartElements.get(definition.key) === entry.target) charts.get(definition.key)?.resize()
        })
        dynamicElements.forEach((element, id) => {
          if (element === entry.target) dynamicCharts.get(id)?.resize()
        })
      })
    })
  }
  window.addEventListener('resize', resizeCharts)
  await nextTick()
  renderAllCharts()
  renderAllDynamicCharts()
  resetRefreshTimer()
  if (route.path.startsWith('/platform') && !scope.initialized && !targetCluster.value) {
    try {
      await scope.initialize({})
    } catch (error) {
      loadError.value = `集群上下文加载失败：${errorText(error)}`
    }
  }
  if (targetCluster.value && !loading.value) loadMonitoring()
})
onBeforeUnmount(() => {
  mounted = false
  requestId++
  if (refreshTimer !== undefined) window.clearInterval(refreshTimer)
  resizeObserver?.disconnect()
  window.removeEventListener('resize', resizeCharts)
  charts.forEach((chart) => chart.dispose())
  charts.clear()
  chartElements.clear()
  clearDynamicCharts()
})
</script>

<style scoped>
.dashboard-page {
  min-width: 0;
}
.context-strip {
  display: flex;
  min-width: 0;
  padding: 14px 18px;
  align-items: center;
  gap: 0;
  overflow-x: auto;
}
.context-entry {
  display: flex;
  min-width: 120px;
  padding: 0 20px;
  flex-direction: column;
  flex-shrink: 0;
  border-right: 1px solid var(--border-light);
}
.context-entry:first-child {
  padding-left: 0;
}
.context-entry > span {
  color: var(--text-tertiary);
  font-size: 11px;
}
.context-entry strong {
  max-width: 260px;
  margin-top: 2px;
  overflow: hidden;
  color: var(--text-regular);
  font-size: 13px;
  font-weight: 550;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.update-status {
  display: flex;
  margin-left: auto;
  padding-left: 20px;
  align-items: center;
  gap: 7px;
  color: var(--text-secondary);
  flex-shrink: 0;
  font-size: 12px;
}
.live-dot {
  width: 7px;
  height: 7px;
  background: var(--success);
  border-radius: 50%;
  box-shadow: 0 0 0 3px rgb(18 183 106 / 10%);
}
.live-dot--busy {
  background: var(--warning);
  box-shadow: 0 0 0 3px rgb(247 144 9 / 10%);
}
.monitor-toolbar {
  display: flex;
  padding: 14px 18px;
  align-items: center;
  gap: 22px;
  flex-wrap: wrap;
}
.toolbar-field {
  display: flex;
  align-items: center;
  gap: 10px;
}
.toolbar-label {
  color: var(--text-secondary);
  flex-shrink: 0;
  font-size: 12px;
}
.refresh-select {
  width: 112px;
}
.toolbar-hint {
  margin-left: auto;
  color: var(--text-tertiary);
  font-size: 11px;
}
.dimension-button {
  margin-left: 12px;
}
.dimension-group {
  margin-bottom: 18px;
}
.dimension-group h4 {
  margin-bottom: 8px;
  font-size: 14px;
}
.dimension-options {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}
.dashboard-variables {
  display: flex;
  padding: 14px 18px;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
}
.dashboard-variable {
  display: flex;
  align-items: center;
  gap: 9px;
}
.dashboard-variable > span {
  color: var(--text-secondary);
  font-size: 12px;
  white-space: nowrap;
}
.dashboard-variable .el-select {
  width: 180px;
}
.variable-hint {
  margin-left: auto;
  color: var(--text-tertiary);
  font-size: 11px;
}
.dashboard-row {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.dashboard-row__header {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.dashboard-row__header h2 {
  font-size: 17px;
}
.dashboard-row__header span {
  color: var(--text-tertiary);
  font-size: 11px;
}
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 16px;
}
.dashboard-panel {
  min-width: 0;
  padding: 18px;
}
.dashboard-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.dashboard-panel__header h3 {
  font-size: 14px;
}
.dashboard-panel__header p {
  margin-top: 4px;
  color: var(--text-tertiary);
  font-size: 11px;
}
.dashboard-panel .chart-container {
  height: 280px;
}
.dashboard-panel__footer {
  display: flex;
  padding-top: 9px;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  color: var(--text-tertiary);
  border-top: 1px solid var(--border-light);
  font-size: 10px;
}
.dashboard-panel__footer > span:first-child {
  overflow: hidden;
  font-family: monospace;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.stat-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  min-height: 110px;
  padding-top: 16px;
}
.stat-entry {
  display: flex;
  min-width: 0;
  padding: 14px;
  background: var(--surface-subtle);
  border: 1px solid var(--border-light);
  border-radius: 9px;
  flex-direction: column;
  gap: 7px;
}
.stat-entry > span {
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.stat-entry strong {
  color: var(--text-primary);
  font-size: 22px;
  font-weight: 650;
}
.stat-entry small {
  margin-left: 5px;
  color: var(--text-tertiary);
  font-size: 11px;
  font-weight: 500;
}
.panel-empty {
  display: flex;
  min-height: 100px;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  font-size: 12px;
}
.chart-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}
.chart-card {
  min-width: 0;
  padding: 20px 20px 14px;
}
.chart-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.chart-card__header h2 {
  font-size: 16px;
}
.chart-card__header p {
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 12px;
}
.stale-badge {
  padding: 3px 7px;
  color: #b54708;
  background: #fffaeb;
  border: 1px solid #fedf89;
  border-radius: 6px;
  flex-shrink: 0;
  font-size: 11px;
}
.chart-container {
  position: relative;
  height: 310px;
  min-width: 0;
  margin-top: 6px;
}
.chart-element {
  width: 100%;
  height: 100%;
}
.chart-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  flex-direction: column;
  justify-content: center;
  color: var(--text-tertiary);
  background: var(--surface-card);
  text-align: center;
}
.chart-empty .el-icon {
  margin-bottom: 10px;
  color: var(--brand-500);
  font-size: 30px;
}
.chart-empty strong {
  color: var(--text-regular);
  font-size: 14px;
  font-weight: 550;
}
.chart-empty span {
  max-width: 280px;
  margin-top: 5px;
  font-size: 12px;
}
.chart-card__footer {
  display: flex;
  padding-top: 10px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--text-tertiary);
  border-top: 1px solid var(--border-light);
  font-size: 11px;
}
@media (max-width: 1200px) {
  .metrics-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .toolbar-hint {
    display: none;
  }
}
@media (max-width: 1050px) {
  .chart-grid {
    grid-template-columns: 1fr;
  }
  .dashboard-panel {
    grid-column: 1 / -1 !important;
  }
}
@media (max-width: 768px) {
  .context-strip {
    padding: 12px 14px;
  }
  .context-entry {
    min-width: 108px;
    padding: 0 14px;
  }
  .update-status {
    display: none;
  }
  .monitor-toolbar {
    align-items: flex-start;
    gap: 14px;
  }
  .toolbar-field--range {
    width: 100%;
    align-items: flex-start;
    flex-direction: column;
  }
  .toolbar-field--range :deep(.el-radio-group) {
    display: grid;
    width: 100%;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .toolbar-field--range :deep(.el-radio-button__inner) {
    width: 100%;
    padding-right: 8px;
    padding-left: 8px;
  }
  .chart-card {
    padding: 17px 12px 12px;
  }
  .chart-container {
    height: 280px;
  }
}
@media (max-width: 520px) {
  .metrics-grid {
    grid-template-columns: 1fr;
  }
  .monitor-toolbar {
    padding: 14px;
  }
  .chart-card__footer span:last-child {
    display: none;
  }
}
</style>
