<template>
  <div class="page page-stack log-page">
    <PageHeader :title="modeTitle" :description="modeDescription" :breadcrumbs="['资源控制台', '日志中心', modeTitle]">
      <template #actions>
        <el-button :icon="Refresh" :loading="loading" :disabled="!canSearch" @click="executeSearch()">刷新日志</el-button>
        <el-button :icon="Star" :disabled="!hasActiveFilters" @click="saveCurrentQuery">收藏</el-button>
        <el-button :icon="Download" :disabled="!logs.length" @click="exportLogs">导出</el-button>
        <el-button type="primary" :icon="Search" :loading="loading" :disabled="!canSearch" @click="submitSearch">查询</el-button>
      </template>
    </PageHeader>

    <section class="log-context surface">
      <div>
        <span>集群</span><strong>{{ scope.cluster || '未选择' }}</strong>
      </div>
      <div>
        <span>空间</span><strong>{{ scope.namespace || '未选择' }}</strong>
      </div>
      <div>
        <span>检索模式</span><strong>{{ modeTitle }}</strong>
      </div>
      <span class="context-update">{{ lastUpdated ? `最近更新 ${formatDate(lastUpdated, true)}` : '等待查询' }}</span>
    </section>

    <el-tabs :model-value="mode" class="mode-tabs" @tab-change="changeMode">
      <el-tab-pane label="搜索模式" name="normal" />
      <el-tab-pane label="实时流模式" name="stream" />
      <el-tab-pane label="全链路检索" name="trace" />
    </el-tabs>

    <section class="search-panel surface">
      <div v-if="savedQueries.length" class="saved-queries">
        <span>已保存查询</span>
        <el-tag
          v-for="query in savedQueries"
          :key="query.name"
          closable
          effect="plain"
          @click="applySavedQuery(query)"
          @close="removeSavedQuery(query.name)"
          >{{ query.name }}</el-tag
        >
      </div>
      <form class="filter-grid" @submit.prevent="submitSearch">
        <label class="filter-field filter-field--keyword">
          <span>{{ mode === 'trace' ? 'Trace ID' : '关键词 / 查询语句' }}</span>
          <el-input v-model="keyword" clearable :placeholder="keywordPlaceholder" :prefix-icon="Search" />
        </label>
        <label class="filter-field">
          <span>日志级别</span>
          <el-select v-model="level" clearable placeholder="全部级别">
            <el-option v-for="item in levels" :key="item" :label="item" :value="item" />
          </el-select>
        </label>
        <label class="filter-field">
          <span>Pod</span>
          <el-input v-model="pod" clearable placeholder="完整 Pod 名称" />
        </label>
        <label class="filter-field">
          <span>日志任务</span>
          <el-select v-model="task" clearable placeholder="全部日志任务">
            <el-option v-for="item in logTasks" :key="item" :label="item" :value="item" />
          </el-select>
        </label>
        <label class="filter-field">
          <span>时间范围</span>
          <el-select v-model="rangeMs" @change="customRange = null">
            <el-option v-for="option in rangeOptions" :key="option.value" :label="option.label" :value="option.value" />
          </el-select>
        </label>
        <div class="filter-actions">
          <el-button native-type="submit" type="primary" :icon="Search" :loading="loading" :disabled="!canSearch">检索</el-button>
          <el-button native-type="button" text @click="resetFilters">重置</el-button>
        </div>
      </form>
      <div class="refresh-row">
        <div class="auto-refresh-control">
          <el-switch v-model="autoRefresh" inline-prompt active-text="自动" inactive-text="暂停" />
          <span>{{ autoRefresh ? '自动刷新已开启' : '自动刷新已暂停' }}</span>
          <el-select v-model="refreshMs" :disabled="!autoRefresh" class="interval-select" aria-label="日志自动刷新间隔">
            <el-option :label="'5 秒 / 次'" :value="5000" />
            <el-option :label="'15 秒 / 次'" :value="15000" />
            <el-option :label="'30 秒 / 次'" :value="30000" />
            <el-option :label="'1 分钟 / 次'" :value="60000" />
          </el-select>
        </div>
        <span class="refresh-tip">查询失败时保留当前日志；后台标签页不会自动请求</span>
      </div>
    </section>

    <el-alert v-if="tracePrompt" type="info" show-icon :closable="false" title="输入 Trace ID 后开始全链路检索" />
    <el-alert v-if="loadError" type="error" show-icon :closable="false" :title="loadError">
      <template #default
        ><el-button link type="primary" :disabled="!canSearch || loading" @click="executeSearch()">重新查询</el-button></template
      >
    </el-alert>

    <section v-if="histogram.length && (logs.length || total)" class="histogram-card surface">
      <header class="section-header">
        <div>
          <h2>日志时间分布</h2>
          <p>{{ histogramSource === 'server' ? '来自服务端聚合结果' : '根据当前页日志计算，仅用于快速观察分布' }}</p>
        </div>
        <div class="histogram-heading-actions">
          <el-tag v-if="customRange" closable effect="plain" @close="clearCustomRange"
            >自定义时段 {{ formatTick(customRange.start) }} - {{ formatTick(customRange.end) }}</el-tag
          ><strong>{{ formatNumber(total, 0) }} 条日志</strong>
        </div>
      </header>
      <div class="histogram" role="img" aria-label="日志数量随时间分布直方图">
        <el-tooltip
          v-for="bucket in histogram"
          :key="bucket.time"
          :content="`${formatDate(bucket.time, true)} · ${bucket.count} 条`"
          placement="top"
        >
          <div class="histogram-column" :class="{ active: bucketActive(bucket) }" @click="selectBucket(bucket)">
            <span class="histogram-value">{{ bucket.count || '' }}</span>
            <div class="histogram-track"><div class="histogram-bar" :style="{ height: `${barHeight(bucket.count)}%` }" /></div>
          </div>
        </el-tooltip>
      </div>
      <div class="histogram-axis">
        <span>{{ formatTick(histogram[0]?.time) }}</span
        ><span>{{ formatTick(histogram[Math.floor(histogram.length / 2)]?.time) }}</span
        ><span>{{ formatTick(histogram.at(-1)?.time) }}</span>
      </div>
    </section>

    <section class="log-table-card surface">
      <header class="section-header table-heading">
        <div>
          <h2>日志明细</h2>
          <p>{{ mode === 'stream' ? '实时流按时间正序展示，本轮最多返回 200 条' : '点击行首箭头展开完整字段与原始 JSON' }}</p>
        </div>
        <span v-if="!loading && logs.length" class="result-count">本页 {{ logs.length }} 条</span>
      </header>
      <el-table v-loading="loading" :data="logs" row-key="id" class="log-table" :row-class-name="rowClassName">
        <el-table-column type="expand" width="44">
          <template #default="{ row }">
            <div class="log-detail">
              <dl>
                <div>
                  <dt>时间</dt>
                  <dd>{{ formatDate(row.timestamp, true) }}</dd>
                </div>
                <div>
                  <dt>集群 / 空间</dt>
                  <dd>{{ row.cluster || scope.cluster }} / {{ row.namespace || scope.namespace }}</dd>
                </div>
                <div>
                  <dt>Pod / 容器</dt>
                  <dd>{{ row.pod || '—' }} / {{ row.container || '—' }}</dd>
                </div>
                <div v-if="row.traceId">
                  <dt>Trace ID</dt>
                  <dd class="mono">{{ row.traceId }}</dd>
                </div>
              </dl>
              <pre>{{ formatRaw(row.raw) }}</pre>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="时间" width="178">
          <template #default="{ row }"
            ><span class="log-time">{{ formatDate(row.timestamp, true) }}</span></template
          >
        </el-table-column>
        <el-table-column label="级别" width="88" align="center">
          <template #default="{ row }"
            ><el-tag :type="levelTagType(row.level)" effect="light" size="small">{{ row.level }}</el-tag></template
          >
        </el-table-column>
        <el-table-column label="Pod / 容器" min-width="200">
          <template #default="{ row }"
            ><div class="pod-cell">
              <span :title="row.pod">{{ row.pod || '—' }}</span
              ><small>{{ row.container || '未知容器' }}</small>
            </div></template
          >
        </el-table-column>
        <el-table-column v-if="mode === 'trace'" label="Trace ID" min-width="190">
          <template #default="{ row }"
            ><span class="mono trace-cell">{{ row.traceId || '—' }}</span></template
          >
        </el-table-column>
        <el-table-column label="日志内容" min-width="400">
          <template #default="{ row }"
            ><div class="log-message" :title="row.message">{{ row.message }}</div></template
          >
        </el-table-column>
        <template #empty>
          <EmptyState
            v-if="!loading"
            :title="tracePrompt ? '等待 Trace ID' : loadError ? '未能获取日志' : '暂无匹配日志'"
            :description="
              tracePrompt
                ? '请输入完整 Trace ID，检索该调用链在当前时间范围内的日志。'
                : loadError
                  ? '请检查日志服务状态或稍后重试。'
                  : '可尝试扩大时间范围、清空级别或 Pod 过滤条件。'
            "
            :action-text="!tracePrompt && !loadError && hasActiveFilters ? '清空过滤条件' : ''"
            @action="resetFilters"
          />
        </template>
      </el-table>
      <footer v-if="mode !== 'stream' && (total > pageSize || logs.length)" class="pagination-row">
        <el-pagination
          background
          :current-page="page"
          :page-size="pageSize"
          :page-sizes="[20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next"
          @current-change="changePage"
          @size-change="changePageSize"
        />
      </footer>
      <footer v-else-if="mode === 'stream' && logs.length" class="stream-footer">
        <span class="stream-indicator" :class="{ paused: !autoRefresh }" />{{
          autoRefresh ? `实时刷新中 · 每 ${refreshMs / 1000} 秒` : '实时刷新已暂停'
        }}
      </footer>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { ElMessageBox } from 'element-plus'
import { Download, Refresh, Search, Star } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { logseerApi } from '@/api/logseer'
import { listLogConfigs } from '@/api/logconfig'
import { useScopeStore } from '@/stores/scope'
import { formatDate, formatNumber, getByPath } from '@/utils/format'

type LogMode = 'normal' | 'stream' | 'trace'
interface LogEntry {
  id: string
  timestamp: number
  level: string
  message: string
  pod: string
  container: string
  namespace: string
  cluster: string
  traceId: string
  raw: Record<string, unknown>
}
interface HistogramBucket {
  time: number
  count: number
}
interface ParsedResponse {
  logs: LogEntry[]
  total: number
  histogram: HistogramBucket[]
  serverHistogram: boolean
}

const route = useRoute()
const router = useRouter()
const scope = useScopeStore()
const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']
const rangeOptions = [
  { label: '近 15 分钟', value: 15 * 60_000 },
  { label: '近 30 分钟', value: 30 * 60_000 },
  { label: '近 1 小时', value: 60 * 60_000 },
  { label: '近 6 小时', value: 6 * 60 * 60_000 },
  { label: '近 24 小时', value: 24 * 60 * 60_000 },
  { label: '近 7 天', value: 7 * 24 * 60 * 60_000 },
]
const mode = computed<LogMode>(() =>
  ['normal', 'stream', 'trace'].includes(String(route.params.type)) ? (route.params.type as LogMode) : 'normal',
)
const modeTitle = computed(
  () => (({ normal: '日志搜索', stream: '实时日志流', trace: '全链路日志检索' }) as Record<LogMode, string>)[mode.value],
)
const modeDescription = computed(
  () =>
    (
      ({
        normal: '按关键词、级别、Pod 与时间范围检索日志，并通过直方图定位异常时段。',
        stream: '持续轮询最新日志，可随时暂停自动刷新并展开单条日志详情。',
        trace: '使用 Trace ID 串联调用链日志，结合级别、Pod 和时间条件缩小排查范围。',
      }) as Record<LogMode, string>
    )[mode.value],
)
const keywordPlaceholder = computed(() =>
  mode.value === 'trace'
    ? '输入完整 Trace ID，例如 4bf92f3577b34da6a3ce929d0e0e4736'
    : '输入关键词或查询语句，例如 status:200 AND extension:PHP',
)
const keyword = ref('')
const level = ref('')
const pod = ref('')
const task = ref('')
const logTasks = ref<string[]>([])
const rangeMs = ref(mode.value === 'stream' ? 15 * 60_000 : 60 * 60_000)
const autoRefresh = ref(mode.value === 'stream')
const refreshMs = ref(mode.value === 'stream' ? 5000 : 15_000)
const logs = ref<LogEntry[]>([])
const histogram = ref<HistogramBucket[]>([])
const histogramSource = ref<'server' | 'local'>('local')
const customRange = ref<{ start: number; end: number } | null>(null)
interface SavedQuery {
  name: string
  keyword: string
  level: string
  pod: string
  task: string
  rangeMs: number
}
const SAVED_QUERY_KEY = 'kubecube-log-queries'
const savedQueries = ref<SavedQuery[]>([])
const total = ref(0)
const loading = ref(false)
const loadError = ref('')
const lastUpdated = ref<number>()
const page = ref(1)
const pageSize = ref(20)
let requestId = 0
let refreshTimer: number | undefined

const tracePrompt = computed(() => mode.value === 'trace' && !keyword.value.trim())
const canSearch = computed(() => Boolean(scope.cluster && scope.namespace && !tracePrompt.value))
const hasActiveFilters = computed(() => Boolean(keyword.value || level.value || pod.value || task.value))
const maxHistogramValue = computed(() => Math.max(0, ...histogram.value.map((item) => item.count)))

function errorText(error: unknown) {
  return error instanceof Error ? error.message : '请求失败，请稍后重试'
}
function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}
function text(value: unknown) {
  return value === undefined || value === null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)
}
function parseTimestamp(value: unknown): number {
  if (typeof value === 'number' || (typeof value === 'string' && /^\d+(\.\d+)?$/.test(value))) {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return 0
    return numeric < 10_000_000_000 ? numeric * 1000 : numeric
  }
  if (typeof value === 'string' || value instanceof Date) {
    const parsed = dayjs(value).valueOf()
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}
function normalizeLevel(value: unknown, message: string) {
  const candidate = text(value).toUpperCase()
  if (['DEBUG', 'INFO', 'WARN', 'WARNING', 'ERROR', 'FATAL', 'TRACE'].includes(candidate))
    return candidate === 'WARNING' ? 'WARN' : candidate
  const matched = message.match(/\b(TRACE|DEBUG|INFO|WARN|WARNING|ERROR|FATAL)\b/i)?.[1]
  return matched?.toUpperCase().replace('WARNING', 'WARN') || 'INFO'
}
function normalizeLog(item: unknown, index: number): LogEntry {
  const wrapper = asRecord(item)
  const source = Object.keys(asRecord(wrapper._source)).length
    ? asRecord(wrapper._source)
    : Object.keys(asRecord(wrapper.source)).length
      ? asRecord(wrapper.source)
      : wrapper
  const message = text(source.message ?? source.log ?? source.msg ?? wrapper.message) || '（空日志内容）'
  const timestamp = parseTimestamp(source['@timestamp'] ?? source.timestamp ?? source.time ?? wrapper.timestamp ?? wrapper.time)
  const id = text(wrapper._id ?? wrapper.id ?? source.id) || `${timestamp}-${index}-${message.slice(0, 24)}`
  return {
    id,
    timestamp,
    message,
    level: normalizeLevel(source.level ?? source.severity ?? source.loglevel ?? source.log_level, message),
    pod: text(source.pod ?? source.pod_name ?? getByPath(source, 'kubernetes.pod_name') ?? getByPath(source, 'kubernetes.pod')),
    container: text(source.container ?? source.container_name ?? getByPath(source, 'kubernetes.container_name')),
    namespace: text(source.namespace ?? source.namespace_name ?? getByPath(source, 'kubernetes.namespace_name')),
    cluster: text(source.cluster_name ?? source.cluster ?? getByPath(source, 'kubernetes.cluster_name')),
    traceId: text(source.traceId ?? source.trace_id ?? getByPath(source, 'trace.id')),
    raw: source,
  }
}
function extractHits(root: Record<string, unknown>): unknown[] {
  if (Array.isArray(root.items)) return root.items
  if (Array.isArray(root.logs)) return root.logs
  if (Array.isArray(root.hits)) return root.hits
  if (Array.isArray(asRecord(root.hits).hits)) return asRecord(root.hits).hits as unknown[]
  const data = asRecord(root.data)
  if (Array.isArray(data.items)) return data.items
  if (Array.isArray(asRecord(data.hits).hits)) return asRecord(data.hits).hits as unknown[]
  return []
}
function extractTotal(root: Record<string, unknown>, fallback: number): number {
  const hitsTotal = asRecord(root.hits).total
  const nestedHitsTotal = asRecord(asRecord(root.data).hits).total
  const candidates = [
    root.total,
    typeof hitsTotal === 'object' ? asRecord(hitsTotal).value : hitsTotal,
    asRecord(root.data).total,
    typeof nestedHitsTotal === 'object' ? asRecord(nestedHitsTotal).value : nestedHitsTotal,
  ]
  const value = candidates.find((item) => item !== undefined && item !== null && item !== '' && Number.isFinite(Number(item)))
  return value === undefined ? fallback : Math.max(0, Number(value))
}
function aggregationBuckets(root: Record<string, unknown>): HistogramBucket[] {
  const aggregations = [asRecord(root.aggregations), asRecord(asRecord(root.data).aggregations)]
  for (const aggregation of aggregations) {
    for (const value of Object.values(aggregation)) {
      const buckets = asRecord(value).buckets
      if (!Array.isArray(buckets)) continue
      return buckets
        .flatMap((bucket) => {
          const item = asRecord(bucket)
          const time = parseTimestamp(item.key_as_string ?? item.key)
          const count = Number(item.doc_count ?? item.count ?? 0)
          return time && Number.isFinite(count) ? [{ time, count }] : []
        })
        .sort((left, right) => left.time - right.time)
    }
  }
  return []
}
function localHistogram(items: LogEntry[], start: number, end: number): HistogramBucket[] {
  const count = 24
  const step = Math.max(1, Math.floor((end - start) / count))
  const buckets = Array.from({ length: count }, (_, index) => ({ time: start + index * step, count: 0 }))
  items.forEach((item) => {
    const index = Math.floor((item.timestamp - start) / step)
    if (index >= 0 && index < count) buckets[index]!.count++
  })
  return buckets
}
function parseResponse(response: unknown, start: number, end: number): ParsedResponse {
  const root = asRecord(response)
  const hits = extractHits(root)
  const entries = hits.map(normalizeLog)
  const serverBuckets = aggregationBuckets(root)
  return {
    logs: entries,
    total: extractTotal(root, entries.length),
    histogram: serverBuckets.length ? serverBuckets : localHistogram(entries, start, end),
    serverHistogram: serverBuckets.length > 0,
  }
}
function buildQuery(start: number, end: number) {
  const filters = [
    { key: 'cluster_name', operator: 'is', value: scope.cluster },
    { key: 'namespace', operator: 'is', value: scope.namespace },
  ]
  if (level.value) filters.push({ key: 'level', operator: 'is', value: level.value })
  if (pod.value.trim()) filters.push({ key: 'pod', operator: 'is', value: pod.value.trim() })
  if (task.value) filters.push({ key: 'logconfig', operator: 'is', value: task.value })
  let query = keyword.value.trim()
  if (mode.value === 'trace' && query && !/^".*"$/.test(query)) query = `"${query}"`
  query = query.replace(/"/g, '\\"')
  const duration = end - start
  const interval = duration <= 60 * 60_000 ? '1m' : duration <= 6 * 60 * 60_000 ? '5m' : duration <= 24 * 60 * 60_000 ? '15m' : '1h'
  return {
    size: mode.value === 'stream' ? 200 : pageSize.value,
    from: mode.value === 'stream' ? 0 : (page.value - 1) * pageSize.value,
    range: { timestamp: { gte: start, lte: end } },
    query,
    aggs: { interval },
    filters,
    sort: { timestamp: mode.value === 'stream' ? 'asc' : 'desc' },
  }
}
async function executeSearch(resetPage = false) {
  if (resetPage) page.value = 1
  if (!canSearch.value) {
    loading.value = false
    if (tracePrompt.value) {
      logs.value = []
      histogram.value = []
      total.value = 0
      loadError.value = ''
    }
    return
  }
  const current = ++requestId
  const end = customRange.value?.end || Date.now()
  const start = customRange.value?.start || end - rangeMs.value
  loading.value = true
  loadError.value = ''
  try {
    const response = await logseerApi.search(buildQuery(start, end))
    if (current !== requestId) return
    const parsed = parseResponse(response, start, end)
    logs.value = parsed.logs
    total.value = parsed.total
    histogram.value = parsed.histogram
    histogramSource.value = parsed.serverHistogram ? 'server' : 'local'
    lastUpdated.value = Date.now()
  } catch (error) {
    if (current === requestId) loadError.value = `日志查询失败：${errorText(error)}。已有日志和分布图已保留。`
  } finally {
    if (current === requestId) loading.value = false
  }
}
function submitSearch() {
  executeSearch(true)
}
function bucketActive(bucket: HistogramBucket) {
  return Boolean(customRange.value && bucket.time >= customRange.value.start && bucket.time < customRange.value.end)
}
function selectBucket(bucket: HistogramBucket) {
  const interval = histogram.value.length > 1 ? histogram.value[1]!.time - histogram.value[0]!.time : 5 * 60_000
  customRange.value = { start: bucket.time, end: bucket.time + Math.max(interval, 60_000) }
  executeSearch(true)
}
function clearCustomRange() {
  customRange.value = null
  executeSearch(true)
}
function csvCell(value: unknown) {
  return `"${text(value).replaceAll('"', '""')}"`
}
function exportLogs() {
  if (!logs.value.length) return
  const rows = [
    ['timestamp', 'level', 'pod', 'message'],
    ...logs.value.map((entry) => [formatDate(entry.timestamp, true), entry.level, entry.pod, entry.message]),
  ]
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `logs-${dayjs().format('YYYYMMDD-HHmmss')}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}
function loadSavedQueries() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SAVED_QUERY_KEY) || '[]') as SavedQuery[]
    savedQueries.value = Array.isArray(parsed)
      ? parsed
          .filter((query) => query && typeof query.name === 'string')
          .map((query) => ({ ...query, rangeMs: Number(query.rangeMs) || rangeMs.value }))
      : []
  } catch {
    savedQueries.value = []
  }
}
function persistSavedQueries() {
  window.localStorage.setItem(SAVED_QUERY_KEY, JSON.stringify(savedQueries.value))
}
async function saveCurrentQuery() {
  try {
    const { value } = await ElMessageBox.prompt('为当前筛选条件命名，后续可一键复用。', '收藏查询', {
      inputPlaceholder: '例如：订单服务错误日志',
      confirmButtonText: '保存',
      cancelButtonText: '取消',
      inputValidator: (input) => Boolean(input?.trim()) || '请输入名称',
    })
    const name = value.trim()
    const query: SavedQuery = { name, keyword: keyword.value, level: level.value, pod: pod.value, task: task.value, rangeMs: rangeMs.value }
    savedQueries.value = [...savedQueries.value.filter((item) => item.name !== name), query]
    persistSavedQueries()
  } catch {
    // 用户取消收藏。
  }
}
function applySavedQuery(query: SavedQuery) {
  keyword.value = query.keyword
  level.value = query.level
  pod.value = query.pod
  task.value = query.task
  rangeMs.value = query.rangeMs
  customRange.value = null
  executeSearch(true)
}
function removeSavedQuery(name: string) {
  savedQueries.value = savedQueries.value.filter((query) => query.name !== name)
  persistSavedQueries()
}
function resetFilters() {
  keyword.value = ''
  level.value = ''
  pod.value = ''
  task.value = ''
  rangeMs.value = mode.value === 'stream' ? 15 * 60_000 : 60 * 60_000
  customRange.value = null
  executeSearch(true)
}
async function loadLogTasks() {
  if (!scope.cluster || !scope.namespace) {
    logTasks.value = []
    task.value = ''
    return
  }
  try {
    const response = await listLogConfigs({ cluster: scope.cluster, namespace: scope.namespace }, { pageNum: 1, pageSize: 200 })
    logTasks.value = (response.items || []).map((item) => item.metadata.name).filter(Boolean)
    if (task.value && !logTasks.value.includes(task.value)) task.value = ''
  } catch {
    logTasks.value = []
    task.value = ''
  }
}
function changePage(value: number) {
  page.value = value
  executeSearch()
}
function changePageSize(value: number) {
  pageSize.value = value
  page.value = 1
  executeSearch()
}
function changeMode(value: string | number) {
  const target = String(value) as LogMode
  if (target === mode.value || !['normal', 'stream', 'trace'].includes(target)) return
  router.push({ path: `/control/lens/${target}`, query: route.query })
}
function barHeight(value: number) {
  return value <= 0 || !maxHistogramValue.value ? 0 : Math.max(5, (value / maxHistogramValue.value) * 100)
}
function formatTick(value?: number) {
  return value ? dayjs(value).format(rangeMs.value > 24 * 60 * 60_000 ? 'MM-DD HH:mm' : 'HH:mm') : '—'
}
function formatRaw(raw: Record<string, unknown>) {
  try {
    return JSON.stringify(raw, null, 2)
  } catch {
    return String(raw)
  }
}
function levelTagType(value: string): 'danger' | 'warning' | 'success' | 'info' {
  if (['ERROR', 'FATAL'].includes(value)) return 'danger'
  if (value === 'WARN') return 'warning'
  if (value === 'INFO') return 'success'
  return 'info'
}
function rowClassName({ row }: { row: LogEntry }) {
  return ['ERROR', 'FATAL'].includes(row.level) ? 'error-log-row' : ''
}
function resetTimer() {
  if (refreshTimer !== undefined) window.clearInterval(refreshTimer)
  refreshTimer = undefined
  if (autoRefresh.value)
    refreshTimer = window.setInterval(() => {
      if (!loading.value && !document.hidden && canSearch.value) executeSearch()
    }, refreshMs.value)
}
function resetForContext() {
  requestId++
  loading.value = false
  page.value = 1
  logs.value = []
  histogram.value = []
  total.value = 0
  loadError.value = ''
  lastUpdated.value = undefined
  void loadLogTasks()
  if (!tracePrompt.value) executeSearch()
}
watch([autoRefresh, refreshMs], resetTimer)
watch(mode, (value) => {
  requestId++
  loading.value = false
  page.value = 1
  keyword.value = ''
  logs.value = []
  histogram.value = []
  total.value = 0
  loadError.value = ''
  lastUpdated.value = undefined
  autoRefresh.value = value === 'stream'
  refreshMs.value = value === 'stream' ? 5000 : 15_000
  rangeMs.value = value === 'stream' ? 15 * 60_000 : 60 * 60_000
  if (value !== 'trace') executeSearch()
})
watch([() => scope.cluster, () => scope.namespace], resetForContext)
onMounted(() => {
  loadSavedQueries()
  resetTimer()
  void loadLogTasks()
  if (mode.value !== 'trace') executeSearch()
})
onBeforeUnmount(() => {
  requestId++
  if (refreshTimer !== undefined) window.clearInterval(refreshTimer)
})
</script>

<style scoped>
.log-page {
  min-width: 0;
}
.log-context {
  display: flex;
  padding: 13px 18px;
  align-items: center;
  gap: 0;
  overflow-x: auto;
}
.log-context > div {
  display: flex;
  min-width: 170px;
  padding: 0 22px;
  flex-direction: column;
  flex-shrink: 0;
  border-right: 1px solid var(--border-light);
}
.log-context > div:first-child {
  padding-left: 0;
}
.log-context span {
  color: var(--text-tertiary);
  font-size: 11px;
}
.log-context strong {
  margin-top: 2px;
  color: var(--text-regular);
  font-size: 13px;
  font-weight: 550;
}
.context-update {
  margin-left: auto;
  padding-left: 20px;
  flex-shrink: 0;
}
.mode-tabs {
  margin-bottom: -10px;
}
.mode-tabs :deep(.el-tabs__header) {
  margin-bottom: 0;
}
.mode-tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
  background: var(--border-light);
}
.mode-tabs :deep(.el-tabs__item) {
  height: 44px;
  padding: 0 22px;
}
.search-panel {
  padding: 20px;
}
.saved-queries {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px dashed var(--border-light);
  color: var(--text-secondary);
  font-size: 12px;
}
.saved-queries .el-tag {
  cursor: pointer;
}
.filter-grid {
  display: grid;
  grid-template-columns: minmax(240px, 2fr) minmax(120px, 0.7fr) minmax(170px, 1fr) minmax(160px, 1fr) minmax(145px, 0.8fr) auto;
  gap: 14px;
  align-items: end;
}
.filter-field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}
.filter-field > span {
  color: var(--text-secondary);
  font-size: 12px;
}
.filter-field :deep(.el-select) {
  width: 100%;
}
.filter-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}
.refresh-row {
  display: flex;
  margin-top: 18px;
  padding-top: 15px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-top: 1px solid var(--border-light);
}
.auto-refresh-control {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-secondary);
  font-size: 12px;
}
.interval-select {
  width: 112px;
}
.refresh-tip {
  color: var(--text-tertiary);
  font-size: 11px;
}
.histogram-card,
.log-table-card {
  min-width: 0;
  padding: 20px;
}
.section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.section-header h2 {
  font-size: 16px;
}
.section-header p {
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 12px;
}
.section-header > strong {
  color: var(--text-regular);
  font-size: 14px;
  font-weight: 550;
  white-space: nowrap;
}
.histogram {
  display: flex;
  height: 142px;
  margin-top: 20px;
  padding: 0 4px;
  align-items: stretch;
  gap: 4px;
  border-bottom: 1px solid var(--border-light);
  background-image: linear-gradient(to bottom, var(--border-light) 1px, transparent 1px);
  background-size: 100% 33.33%;
}
.histogram > span,
.histogram-column {
  min-width: 0;
  height: 100%;
  flex: 1;
}
.histogram-column {
  display: flex;
  align-items: center;
  flex-direction: column;
  justify-content: flex-end;
  cursor: pointer;
}
.histogram-column.active .histogram-bar {
  background: var(--brand-600);
  opacity: 1;
}
.histogram-heading-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.histogram-value {
  height: 18px;
  color: var(--text-tertiary);
  font-size: 9px;
  opacity: 0;
  transition: opacity 0.15s;
}
.histogram-column:hover .histogram-value {
  opacity: 1;
}
.histogram-track {
  display: flex;
  width: 100%;
  height: calc(100% - 18px);
  align-items: flex-end;
  justify-content: center;
}
.histogram-bar {
  width: 88%;
  min-height: 0;
  background: linear-gradient(180deg, #8490ff, var(--brand-500));
  border-radius: 3px 3px 0 0;
  transition:
    height 0.25s var(--ease),
    background 0.15s;
}
.histogram-column:hover .histogram-bar {
  background: var(--brand-600);
}
.histogram-axis {
  display: flex;
  margin-top: 7px;
  justify-content: space-between;
  color: var(--text-tertiary);
  font-size: 10px;
}
.table-heading {
  margin-bottom: 16px;
}
.result-count {
  color: var(--text-secondary);
  font-size: 12px;
}
.log-table {
  width: 100%;
}
.log-table :deep(.el-table__cell) {
  padding: 11px 0;
}
.log-table :deep(.error-log-row) {
  background: #fffafa;
}
.log-time {
  color: var(--text-secondary);
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 12px;
}
.pod-cell {
  min-width: 0;
}
.pod-cell > span {
  display: block;
  overflow: hidden;
  color: var(--text-regular);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pod-cell small {
  display: block;
  margin-top: 2px;
  color: var(--text-tertiary);
}
.log-message {
  display: -webkit-box;
  overflow: hidden;
  color: var(--text-regular);
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 12px;
  line-height: 20px;
  white-space: normal;
  word-break: break-word;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.trace-cell {
  color: var(--text-secondary);
  font-size: 12px;
}
.log-detail {
  padding: 8px 22px 16px 54px;
  background: var(--surface-subtle);
}
.log-detail dl {
  display: grid;
  margin: 0 0 14px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 24px;
}
.log-detail dl > div {
  display: flex;
  min-width: 0;
  gap: 10px;
}
.log-detail dt {
  color: var(--text-tertiary);
  flex-shrink: 0;
  font-size: 12px;
}
.log-detail dd {
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--text-regular);
  font-size: 12px;
}
.log-detail pre {
  max-height: 360px;
  margin: 0;
  padding: 16px;
  overflow: auto;
  color: #dbe4ff;
  background: #172036;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}
.pagination-row {
  display: flex;
  margin-top: 18px;
  justify-content: flex-end;
  overflow-x: auto;
}
.stream-footer {
  display: flex;
  margin-top: 16px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 12px;
}
.stream-indicator {
  width: 7px;
  height: 7px;
  background: var(--success);
  border-radius: 50%;
  box-shadow: 0 0 0 4px rgb(18 183 106 / 10%);
}
.stream-indicator.paused {
  background: var(--text-tertiary);
  box-shadow: none;
}
@media (max-width: 1250px) {
  .filter-grid {
    grid-template-columns: minmax(240px, 2fr) repeat(2, minmax(140px, 1fr));
  }
  .filter-field--keyword {
    grid-column: span 2;
  }
  .filter-actions {
    justify-content: flex-end;
  }
}
@media (max-width: 768px) {
  .log-context > div {
    min-width: 130px;
    padding: 0 14px;
  }
  .context-update {
    display: none;
  }
  .search-panel,
  .histogram-card,
  .log-table-card {
    padding: 16px;
  }
  .filter-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  .filter-field--keyword {
    grid-column: 1 / -1;
  }
  .filter-actions {
    justify-content: flex-start;
  }
  .refresh-row {
    align-items: flex-start;
    flex-direction: column;
  }
  .refresh-tip {
    display: none;
  }
  .histogram {
    gap: 2px;
  }
  .histogram-value {
    display: none;
  }
  .histogram-track {
    height: 100%;
  }
  .log-detail {
    padding: 10px 14px;
  }
  .log-detail dl {
    grid-template-columns: 1fr;
  }
  .pagination-row {
    justify-content: flex-start;
  }
}
@media (max-width: 480px) {
  .filter-grid {
    grid-template-columns: 1fr;
  }
  .filter-field--keyword {
    grid-column: auto;
  }
  .auto-refresh-control {
    flex-wrap: wrap;
  }
  .section-header > strong {
    display: none;
  }
  .mode-tabs :deep(.el-tabs__item) {
    padding: 0 12px;
    font-size: 12px;
  }
}
</style>
