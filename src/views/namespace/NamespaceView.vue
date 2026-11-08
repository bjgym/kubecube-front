<template>
  <div class="namespace-page">
    <section class="welcome-panel">
      <div class="welcome-panel__inner">
        <div class="welcome-copy">
          <span class="welcome-copy__eyebrow">KUBECUBE WORKSPACE</span>
          <h1>{{ greeting }}，{{ displayUserName }}</h1>
          <p>欢迎回到我的空间。集中查看你在不同集群中的应用、资源用量与工作负载状态。</p>
        </div>
        <el-button class="welcome-refresh" :icon="Refresh" :loading="loading" @click="loadSpaces">刷新空间</el-button>
      </div>
      <div class="context-summary" aria-label="当前四级工作空间上下文">
        <div v-for="item in contextItems" :key="item.label" class="context-item">
          <span class="context-item__icon"
            ><el-icon><component :is="item.icon" /></el-icon
          ></span>
          <div>
            <span>{{ item.label }}</span
            ><strong :title="item.value">{{ item.value }}</strong>
          </div>
        </div>
      </div>
    </section>

    <main class="namespace-content page-stack">
      <el-alert v-if="isMock" type="info" show-icon :closable="false" title="当前为 Mock 预览">
        <template #default>空间与集群来自 mock 数据；资源计数及 CPU / 内存 request、limit 汇总为静态预览，不代表真实用量。</template>
      </el-alert>
      <el-alert v-if="loadError" type="error" show-icon :closable="false" :title="loadError">
        <template #default><el-button link type="primary" @click="loadSpaces">重新加载</el-button></template>
      </el-alert>
      <el-alert v-if="degradedCount" type="warning" show-icon :closable="false" :title="`${degradedCount} 个空间的部分汇总暂不可用`">
        <template #default>已保留对应空间上一次成功的数据，可稍后刷新；空间入口不受影响。</template>
      </el-alert>

      <div class="metrics-grid">
        <MetricCard label="可见集群" :value="clusters.length" caption="当前账号可访问的集群" :loading="initialLoading" tone="info">
          <template #icon
            ><el-icon><Connection /></el-icon
          ></template>
        </MetricCard>
        <MetricCard label="我的空间" :value="cards.length" caption="跨全部可见集群统计" :loading="initialLoading">
          <template #icon
            ><el-icon><Collection /></el-icon
          ></template>
        </MetricCard>
        <MetricCard
          label="工作负载"
          :value="totalWorkloads"
          caption="Deployment / StatefulSet / DaemonSet"
          :loading="initialLoading"
          tone="success"
        >
          <template #icon
            ><el-icon><Box /></el-icon
          ></template>
        </MetricCard>
        <MetricCard label="Pods" :value="totalPods" caption="当前空间资源计数汇总" :loading="initialLoading" tone="warning">
          <template #icon
            ><el-icon><Grid /></el-icon
          ></template>
        </MetricCard>
      </div>

      <section class="spaces-section">
        <div class="spaces-toolbar">
          <div>
            <div class="section-title-row">
              <h2>全部空间</h2>
              <span class="count-badge">{{ filteredCards.length }}</span>
            </div>
            <p>选择资源类型可直达对应空间，卡片指标彼此独立加载。</p>
          </div>
          <div class="spaces-filters">
            <el-select v-model="clusterFilter" clearable placeholder="全部集群" class="cluster-filter">
              <el-option
                v-for="cluster in clusters"
                :key="cluster.clusterName"
                :label="clusterName(cluster)"
                :value="cluster.clusterName"
              />
            </el-select>
            <el-input v-model="keyword" clearable :prefix-icon="Search" placeholder="搜索空间或集群" class="space-search" />
          </div>
        </div>

        <div v-if="initialLoading" class="namespace-grid">
          <section v-for="index in 4" :key="index" class="namespace-card surface namespace-card--skeleton">
            <el-skeleton :rows="8" animated />
          </section>
        </div>
        <EmptyState
          v-else-if="!filteredCards.length"
          class="surface"
          :title="hasFilters ? '没有匹配的空间' : '暂无可访问空间'"
          :description="hasFilters ? '请尝试更换集群或清空搜索关键词。' : '当前账号在可见集群中还没有空间，请联系管理员分配。'"
          :action-text="hasFilters ? '清空筛选' : ''"
          @action="clearFilters"
        />

        <div v-else class="namespace-grid">
          <article v-for="card in filteredCards" :key="card.id" class="namespace-card surface">
            <header class="namespace-card__header">
              <div class="namespace-card__identity">
                <span class="namespace-icon"
                  ><el-icon><FolderOpened /></el-icon
                ></span>
                <div>
                  <h3 :title="card.name">{{ card.name }}</h3>
                  <p :title="card.clusterLabel">{{ card.clusterLabel }} · {{ card.cluster }}</p>
                </div>
              </div>
              <div class="namespace-card__badges">
                <span v-if="card.preview" class="preview-badge">预览</span
                ><StatusTag :status="card.status" :label="phaseLabel(card.status)" />
              </div>
            </header>

            <div class="usage-section">
              <div v-for="group in resourceGroups(card)" :key="group.key" class="usage-group">
                <div class="usage-group__heading">
                  <span>{{ group.label }} 使用</span><strong>{{ group.usageText }}</strong>
                </div>
                <div v-for="row in group.rows" :key="row.label" class="usage-row">
                  <div class="usage-row__meta">
                    <span>{{ row.label }} · {{ row.totalText }}</span
                    ><strong>{{ row.percentText }}</strong>
                  </div>
                  <el-progress :percentage="row.progress" :show-text="false" :stroke-width="6" :color="row.color" />
                </div>
                <el-skeleton v-if="card.summaryLoading && group.isEmpty" :rows="2" animated class="usage-skeleton" />
              </div>
            </div>
            <p v-if="card.metricsError" class="card-degraded" :title="card.metricsError">
              <el-icon><Warning /></el-icon>监控指标暂不可用，已保留旧数据
            </p>

            <div class="resource-counts" aria-label="空间资源计数与快捷入口">
              <button
                v-for="resource in resourceLinks"
                :key="resource.key"
                type="button"
                class="resource-count"
                @click="openResource(card, resource.key)"
              >
                <span>{{ resource.label }}</span
                ><strong>{{ countText(card.counts[resource.key]) }}</strong>
              </button>
            </div>
            <p v-if="card.resourcesError" class="card-degraded" :title="card.resourcesError">
              <el-icon><Warning /></el-icon>资源计数暂不可用，已保留旧数据
            </p>

            <footer class="namespace-card__footer">
              <span>创建于 {{ formatDate(card.createdAt) }}</span>
              <el-button type="primary" plain @click="openConsole(card)"
                >进入控制台<el-icon class="el-icon--right"><Right /></el-icon
              ></el-button>
            </footer>
          </article>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Box, Briefcase, Collection, Connection, FolderOpened, Grid, Refresh, Right, Search, User, Warning } from '@element-plus/icons-vue'
import MetricCard from '@/components/MetricCard.vue'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import { clusterApi, namespaceApi } from '@/api/cluster'
import { monitorApi } from '@/api/observability'
import { resourceApi } from '@/api/resource'
import { getResourceConfig } from '@/config/resources'
import { controlLanding } from '@/config/access'
import { useAuthStore } from '@/stores/auth'
import { useScopeStore } from '@/stores/scope'
import { useFeatureStore } from '@/stores/feature'
import { navigateToScope } from '@/router/scope-query'
import type { ClusterInfo, NamespaceInfo } from '@/types/api'
import { formatBytes, formatDate, formatNumber } from '@/utils/format'

const resourceLinks = [
  { key: 'deployments', label: 'Deployments' },
  { key: 'statefulsets', label: 'StatefulSets' },
  { key: 'daemonsets', label: 'DaemonSets' },
  { key: 'pods', label: 'Pods' },
  { key: 'services', label: 'Services' },
  { key: 'ingresses', label: 'Ingresses' },
] as const

type ResourceKey = (typeof resourceLinks)[number]['key']
interface UsageStats {
  cpuUsage: number | null
  cpuRequest: number | null
  cpuLimit: number | null
  memoryUsage: number | null
  memoryRequest: number | null
  memoryLimit: number | null
}
interface NamespaceCard {
  id: string
  name: string
  cluster: string
  clusterLabel: string
  status: string
  createdAt?: string
  counts: Record<ResourceKey, number | null>
  usage: UsageStats
  summaryLoading: boolean
  metricsError: string
  resourcesError: string
  preview: boolean
}
interface NamespaceResult {
  cluster: ClusterInfo
  namespaces: NamespaceInfo[]
  error: string
}

const router = useRouter()
const auth = useAuthStore()
const scope = useScopeStore()
const features = useFeatureStore()
const isMock = import.meta.env.VITE_USE_MOCK === 'true'
const clusters = ref<ClusterInfo[]>([])
const cards = ref<NamespaceCard[]>([])
const loading = ref(false)
const loadError = ref('')
const keyword = ref('')
const clusterFilter = ref('')
let generation = 0

const displayUserName = computed(() => auth.user?.AccountDisplayName || auth.user?.AccountId || '用户')
const greeting = computed(() => {
  const hour = new Date().getHours()
  return hour < 6 ? '夜深了' : hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好'
})
const initialLoading = computed(() => loading.value && !cards.value.length)
const hasFilters = computed(() => Boolean(keyword.value.trim() || clusterFilter.value))
const degradedCount = computed(() => cards.value.filter((card) => card.metricsError || card.resourcesError).length)
const filteredCards = computed(() => {
  const search = keyword.value.trim().toLowerCase()
  return cards.value.filter(
    (card) =>
      (!clusterFilter.value || card.cluster === clusterFilter.value) &&
      (!search || [card.name, card.cluster, card.clusterLabel].some((value) => value.toLowerCase().includes(search))),
  )
})
const totalWorkloads = computed(() => sumCounts(['deployments', 'statefulsets', 'daemonsets']))
const totalPods = computed(() => sumCounts(['pods']))
const contextItems = computed(() => [
  { label: '租户', value: displayResourceName(scope.currentTenant) || scope.tenant || '未选择', icon: User },
  { label: '项目', value: displayResourceName(scope.currentProject) || scope.project || '未选择', icon: Briefcase },
  { label: '集群', value: scope.currentCluster ? clusterName(scope.currentCluster) : scope.cluster || '未选择', icon: Connection },
  { label: '当前空间', value: scope.namespace || '未选择', icon: FolderOpened },
])

function displayResourceName(item?: { metadata: { name: string }; spec?: unknown }) {
  if (!item) return ''
  const spec = item.spec as Record<string, unknown> | undefined
  return String(spec?.displayName || item.metadata.name)
}
function clusterName(cluster: ClusterInfo) {
  return cluster.clusterDisplayName || cluster.annotations?.['cluster.kubecube.io/cn-name'] || cluster.clusterName
}
function phaseLabel(status: string) {
  return ({ active: '活跃', terminating: '终止中' } as Record<string, string>)[status.toLowerCase()] || status || '未知'
}
function countText(value: number | null | undefined) {
  return value === null || value === undefined ? '—' : formatNumber(value, 0)
}
function sumCounts(keys: ResourceKey[]) {
  const values = cards.value
    .flatMap((card) => keys.map((key) => card.counts[key]))
    .filter((value): value is number => typeof value === 'number')
  return values.length ? values.reduce((sum, value) => sum + value, 0) : '—'
}
function errorText(error: unknown) {
  return error instanceof Error ? error.message : '请求失败，请稍后重试'
}
function escapePrometheus(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}
function selector(card: NamespaceCard) {
  return `cluster="${escapePrometheus(card.cluster)}",namespace="${escapePrometheus(card.name)}"`
}
function emptyCounts(): Record<ResourceKey, number | null> {
  return Object.fromEntries(resourceLinks.map((item) => [item.key, null])) as Record<ResourceKey, number | null>
}
function emptyUsage(): UsageStats {
  return { cpuUsage: null, cpuRequest: null, cpuLimit: null, memoryUsage: null, memoryRequest: null, memoryLimit: null }
}
function hashText(value: string) {
  return [...value].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7)
}
function previewUsage(id: string): UsageStats {
  const seed = hashText(id)
  const cpuRequest = 3 + (seed % 9)
  const memoryRequest = (6 + (seed % 18)) * 1024 ** 3
  return {
    cpuRequest,
    cpuLimit: cpuRequest * 2,
    cpuUsage: cpuRequest * (0.38 + (seed % 35) / 100),
    memoryRequest,
    memoryLimit: memoryRequest * 2,
    memoryUsage: memoryRequest * (0.42 + (seed % 31) / 100),
  }
}
function previewCounts(id: string): Record<ResourceKey, number | null> {
  const seed = hashText(id)
  return Object.fromEntries(
    resourceLinks.map((item, index) => [item.key, 1 + ((seed >>> index) % (item.key === 'pods' ? 18 : 6))]),
  ) as Record<ResourceKey, number | null>
}
function makeCard(cluster: ClusterInfo, item: NamespaceInfo, previous?: NamespaceCard): NamespaceCard {
  const name = item.metadata.name
  const id = `${cluster.clusterName}/${name}`
  return {
    id,
    name,
    cluster: cluster.clusterName,
    clusterLabel: clusterName(cluster),
    status: item.status?.phase || 'Unknown',
    createdAt: item.metadata.creationTimestamp,
    counts: previous?.counts || (isMock ? previewCounts(id) : emptyCounts()),
    usage: previous?.usage || (isMock ? previewUsage(id) : emptyUsage()),
    summaryLoading: !previous && !isMock,
    metricsError: previous?.metricsError || '',
    resourcesError: previous?.resourcesError || '',
    preview: isMock,
  }
}
function embeddedNamespaces(cluster: ClusterInfo): NamespaceInfo[] | null {
  const value = cluster.namespaces
  if (!Array.isArray(value)) return null
  return value.filter((item): item is NamespaceInfo => Boolean(item && typeof item === 'object' && 'metadata' in item))
}
function namespaceSelectors() {
  return [`kubecube.io/tenant=${scope.tenant}`, `kubecube.io/project=${scope.project}`].filter((item) => !item.endsWith('=')).join(',')
}
function usageRow(usage: number | null, total: number | null, kind: 'cpu' | 'memory') {
  const ratio = usage !== null && total !== null && total > 0 ? usage / total : null
  const percentage = ratio === null ? 0 : Math.min(100, Math.max(0, ratio * 100))
  const color = ratio !== null && ratio > 0.9 ? 'var(--danger)' : ratio !== null && ratio > 0.75 ? 'var(--warning)' : 'var(--brand-500)'
  const format = (value: number | null) => (value === null ? '—' : kind === 'cpu' ? `${formatNumber(value)} Core` : formatBytes(value, 'B'))
  return { totalText: format(total), percentText: ratio === null ? '—' : `${formatNumber(ratio * 100, 1)}%`, progress: percentage, color }
}
function resourceGroups(card: NamespaceCard) {
  const groups = [
    { key: 'cpu', label: 'CPU', usage: card.usage.cpuUsage, request: card.usage.cpuRequest, limit: card.usage.cpuLimit },
    { key: 'memory', label: '内存', usage: card.usage.memoryUsage, request: card.usage.memoryRequest, limit: card.usage.memoryLimit },
  ] as const
  return groups.map((group) => ({
    ...group,
    usageText: group.usage === null ? '—' : group.key === 'cpu' ? `${formatNumber(group.usage)} Core` : formatBytes(group.usage, 'B'),
    isEmpty: group.usage === null && group.request === null && group.limit === null,
    rows: [
      { label: 'Request', ...usageRow(group.usage, group.request, group.key) },
      { label: 'Limit', ...usageRow(group.usage, group.limit, group.key) },
    ],
  }))
}
function vectorValue(response: unknown): number | null {
  if (!response || typeof response !== 'object') return null
  const data = (response as Record<string, unknown>).data
  if (!data || typeof data !== 'object') return null
  const result = (data as Record<string, unknown>).result
  if (!Array.isArray(result) || !result.length) return null
  const first = result[0] as Record<string, unknown>
  const value = Array.isArray(first.value)
    ? first.value[1]
    : Array.isArray(first.values)
      ? (first.values.at(-1) as unknown[] | undefined)?.[1]
      : undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}
async function loadUsage(card: NamespaceCard): Promise<UsageStats> {
  const labels = selector(card)
  const expressions = {
    cpuUsage: `sum(rate(container_cpu_usage_seconds_total{${labels},container!="",image!=""}[5m]))`,
    cpuRequest: `sum(kube_pod_container_resource_requests{${labels},resource="cpu"})`,
    cpuLimit: `sum(kube_pod_container_resource_limits{${labels},resource="cpu"})`,
    memoryUsage: `sum(container_memory_working_set_bytes{${labels},container!="",image!=""})`,
    memoryRequest: `sum(kube_pod_container_resource_requests{${labels},resource="memory"})`,
    memoryLimit: `sum(kube_pod_container_resource_limits{${labels},resource="memory"})`,
  }
  const entries = await Promise.all(
    Object.entries(expressions).map(async ([key, query]) => [key, vectorValue(await monitorApi.query({ query }))] as const),
  )
  return Object.fromEntries(entries) as unknown as UsageStats
}
async function loadCounts(card: NamespaceCard): Promise<Record<ResourceKey, number | null>> {
  const entries: [ResourceKey, number | null][] = []
  for (const resource of resourceLinks) {
    const definition = getResourceConfig(resource.key)
    if (!definition) {
      entries.push([resource.key, null])
      continue
    }
    try {
      const response = await resourceApi.list(
        definition,
        { cluster: card.cluster, namespace: card.name },
        { pageNum: 1, pageSize: 1 },
        { silent: true },
      )
      entries.push([resource.key, response.total ?? response.items?.length ?? 0])
    } catch {
      entries.push([resource.key, null])
    }
  }
  return Object.fromEntries(entries) as Record<ResourceKey, number | null>
}
function patchCard(id: string, patch: Partial<NamespaceCard>) {
  const index = cards.value.findIndex((card) => card.id === id)
  if (index >= 0) cards.value[index] = { ...cards.value[index]!, ...patch }
}
async function loadSpaces() {
  const current = ++generation
  loading.value = true
  loadError.value = ''
  const previous = new Map(cards.value.map((card) => [card.id, card]))
  try {
    const [visibleResponse, clusterResponse] = await Promise.all([clusterApi.visible({ prune: true }), clusterApi.list({ prune: true })])
    if (current !== generation) return
    const visibleNames = (visibleResponse.items || []).map((item) => (typeof item === 'string' ? item : item.clusterName))
    clusters.value = (clusterResponse.items || []).filter((cluster) => visibleNames.includes(cluster.clusterName))
    const results: NamespaceResult[] = []
    for (const cluster of clusters.value) {
      try {
        const embedded = embeddedNamespaces(cluster)
        const namespaces = embedded || (await namespaceApi.list(cluster.clusterName, { labelSelector: namespaceSelectors() })).items || []
        results.push({ cluster, namespaces: namespaces.map((item) => ({ ...item, cluster: cluster.clusterName })), error: '' })
      } catch (error) {
        const retained = [...previous.values()]
          .filter((card) => card.cluster === cluster.clusterName)
          .map((card) => ({
            metadata: { name: card.name, creationTimestamp: card.createdAt },
            status: { phase: card.status },
            cluster: card.cluster,
          }))
        results.push({ cluster, namespaces: retained, error: `${clusterName(cluster)}：${errorText(error)}` })
      }
    }
    if (current !== generation) return
    const errors = results.filter((result) => result.error)
    if (errors.length) loadError.value = `部分空间加载失败，已保留旧数据。${errors.map((item) => item.error).join('；')}`
    cards.value = results.flatMap((result) =>
      result.namespaces.map((item) => {
        const id = `${result.cluster.clusterName}/${item.metadata.name}`
        return makeCard(result.cluster, item, previous.get(id))
      }),
    )
    if (isMock) return
    const queue = [...cards.value]
    const workers = Array.from({ length: Math.min(2, queue.length) }, async () => {
      for (let card = queue.shift(); card; card = queue.shift()) {
        const [usageResult, countResult] = await Promise.allSettled([
          features.monitoring ? loadUsage(card) : Promise.resolve(card.usage),
          loadCounts(card),
        ])
        if (current !== generation) return
        const old = previous.get(card.id)
        patchCard(card.id, {
          usage: usageResult.status === 'fulfilled' ? usageResult.value : old?.usage || card.usage,
          counts: countResult.status === 'fulfilled' ? countResult.value : old?.counts || card.counts,
          metricsError: features.monitoring && usageResult.status === 'rejected' ? errorText(usageResult.reason) : '',
          resourcesError: countResult.status === 'rejected' ? errorText(countResult.reason) : '',
          summaryLoading: false,
        })
      }
    })
    await Promise.all(workers)
  } catch (error) {
    if (current === generation) loadError.value = `空间数据加载失败：${errorText(error)}。已保留当前列表。`
  } finally {
    if (current === generation) loading.value = false
  }
}
function clearFilters() {
  keyword.value = ''
  clusterFilter.value = ''
}
async function openConsole(card: NamespaceCard) {
  await navigateToScope(router, controlLanding(features.monitoring), scope.query, { cluster: card.cluster, namespace: card.name })
}
async function openResource(card: NamespaceCard, resource: ResourceKey) {
  await navigateToScope(router, `/control/${resource}/list`, scope.query, { cluster: card.cluster, namespace: card.name })
}
watch([() => scope.tenant, () => scope.project], () => {
  generation++
  cards.value = []
  clusters.value = []
  loadSpaces()
})
onMounted(loadSpaces)
onBeforeUnmount(() => {
  generation++
})
</script>

<style scoped>
.namespace-page {
  min-height: 100%;
  background: var(--surface-page);
}
.welcome-panel {
  position: relative;
  padding: var(--welcome-padding) max(28px, calc((100vw - var(--content-max)) / 2));
  overflow: hidden;
  color: #fff;
  background:
    radial-gradient(circle at 85% 10%, rgb(133 150 255 / 45%), transparent 33%),
    linear-gradient(118deg, #273474 0%, #424fb4 52%, #5b6cff 100%);
}
.welcome-panel::after {
  position: absolute;
  right: 8%;
  bottom: -110px;
  width: 280px;
  height: 280px;
  border: 1px solid rgb(255 255 255 / 12%);
  border-radius: 50%;
  box-shadow:
    0 0 0 42px rgb(255 255 255 / 3%),
    0 0 0 84px rgb(255 255 255 / 3%);
  content: '';
  pointer-events: none;
}
.welcome-panel__inner {
  position: relative;
  z-index: 1;
  display: flex;
  max-width: var(--content-max);
  margin: 0 auto;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
}
.welcome-copy__eyebrow {
  color: rgb(255 255 255 / 64%);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.16em;
}
.welcome-copy h1 {
  margin-top: 8px;
  color: #fff;
  font-size: var(--welcome-title-size);
  line-height: 1.35;
}
.welcome-copy p {
  max-width: 680px;
  margin-top: 10px;
  color: rgb(255 255 255 / 76%);
  font-size: 14px;
  line-height: 24px;
}
.welcome-refresh {
  flex-shrink: 0;
  color: #fff;
  background: rgb(255 255 255 / 12%);
  border-color: rgb(255 255 255 / 28%);
}
.welcome-refresh:hover {
  color: #fff;
  background: rgb(255 255 255 / 20%);
  border-color: rgb(255 255 255 / 45%);
}
.context-summary {
  position: relative;
  z-index: 1;
  display: grid;
  max-width: var(--content-max);
  margin: 28px auto 0;
  padding: 16px 20px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 20px;
  background: rgb(255 255 255 / 10%);
  border: 1px solid rgb(255 255 255 / 14%);
  border-radius: 12px;
  backdrop-filter: blur(12px);
}
.context-item {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}
.context-item__icon {
  display: grid;
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  color: #fff;
  background: rgb(255 255 255 / 12%);
  border-radius: 9px;
  place-items: center;
  font-size: 18px;
}
.context-item > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
}
.context-item span:not(.context-item__icon) {
  color: rgb(255 255 255 / 60%);
  font-size: 11px;
}
.context-item strong {
  overflow: hidden;
  color: #fff;
  font-size: 13px;
  font-weight: 550;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.namespace-content {
  width: calc(100% - 56px);
  max-width: var(--content-max);
  margin: 0 auto;
  padding: 26px 0 40px;
}
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}
.spaces-section {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.spaces-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}
.section-title-row {
  display: flex;
  align-items: center;
  gap: 9px;
}
.section-title-row h2 {
  font-size: 19px;
}
.count-badge {
  min-width: 24px;
  padding: 1px 7px;
  color: var(--brand-600);
  background: var(--brand-50);
  border-radius: 999px;
  font-size: 12px;
  text-align: center;
}
.spaces-toolbar p {
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 13px;
}
.spaces-filters {
  display: flex;
  gap: 10px;
}
.cluster-filter {
  width: 210px;
}
.space-search {
  width: 240px;
}
.namespace-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}
.namespace-card {
  min-width: 0;
  padding: 22px;
  transition:
    border-color 0.2s,
    box-shadow 0.2s,
    transform 0.2s;
}
.namespace-card:not(.namespace-card--skeleton):hover {
  border-color: var(--brand-200);
  box-shadow: var(--shadow-sm);
  transform: translateY(-2px);
}
.namespace-card--skeleton {
  min-height: 430px;
}
.namespace-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}
.namespace-card__identity {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}
.namespace-icon {
  display: grid;
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  color: var(--brand-600);
  background: var(--brand-50);
  border-radius: 11px;
  place-items: center;
  font-size: 21px;
}
.namespace-card__identity > div {
  min-width: 0;
}
.namespace-card h3 {
  overflow: hidden;
  font-size: 17px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.namespace-card__identity p {
  margin-top: 3px;
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.namespace-card__badges {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
}
.preview-badge {
  padding: 3px 7px;
  color: #175cd3;
  background: #eff8ff;
  border: 1px solid #b2ddff;
  border-radius: 6px;
  font-size: 11px;
}
.usage-section {
  display: grid;
  margin-top: 22px;
  padding: 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
  background: var(--surface-subtle);
  border: 1px solid var(--border-light);
  border-radius: 10px;
}
.usage-group {
  position: relative;
  min-width: 0;
}
.usage-group__heading {
  display: flex;
  margin-bottom: 12px;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 12px;
}
.usage-group__heading strong {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}
.usage-row + .usage-row {
  margin-top: 11px;
}
.usage-row__meta {
  display: flex;
  margin-bottom: 5px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 11px;
}
.usage-row__meta > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.usage-row__meta strong {
  color: var(--text-regular);
  font-weight: 550;
}
.usage-skeleton {
  position: absolute;
  inset: 0;
  background: var(--surface-subtle);
}
.card-degraded {
  display: flex;
  margin-top: 8px;
  align-items: center;
  gap: 5px;
  color: var(--warning);
  font-size: 11px;
}
.resource-counts {
  display: grid;
  margin-top: 18px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-top: 1px solid var(--border-light);
  border-left: 1px solid var(--border-light);
  border-radius: 8px;
  overflow: hidden;
}
.resource-count {
  display: flex;
  min-width: 0;
  padding: 11px 10px;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  color: var(--text-secondary);
  background: #fff;
  border: 0;
  border-right: 1px solid var(--border-light);
  border-bottom: 1px solid var(--border-light);
  cursor: pointer;
}
.resource-count:hover {
  color: var(--brand-600);
  background: var(--brand-50);
}
.resource-count span {
  overflow: hidden;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.resource-count strong {
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 600;
}
.namespace-card__footer {
  display: flex;
  margin-top: 18px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.namespace-card__footer > span {
  color: var(--text-tertiary);
  font-size: 11px;
}
@media (min-width: 1600px) {
  .namespace-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .usage-section {
    grid-template-columns: 1fr;
    gap: 14px;
  }
}
@media (max-width: 1100px) {
  .metrics-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .context-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .namespace-grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 768px) {
  .welcome-panel {
    padding: 28px 16px;
  }
  .welcome-panel__inner,
  .spaces-toolbar {
    align-items: stretch;
    flex-direction: column;
  }
  .welcome-copy h1 {
    font-size: 25px;
  }
  .welcome-refresh {
    align-self: flex-start;
  }
  .context-summary {
    padding: 14px;
    gap: 14px 10px;
  }
  .context-item__icon {
    display: none;
  }
  .namespace-content {
    width: calc(100% - 32px);
    padding-top: 18px;
  }
  .spaces-filters {
    width: 100%;
    flex-direction: column;
  }
  .cluster-filter,
  .space-search {
    width: 100%;
  }
  .namespace-card {
    padding: 17px;
  }
  .usage-section {
    grid-template-columns: 1fr;
    gap: 18px;
  }
}
@media (max-width: 480px) {
  .metrics-grid {
    grid-template-columns: 1fr;
  }
  .context-summary {
    grid-template-columns: 1fr;
  }
  .namespace-card__header {
    flex-direction: column;
  }
  .namespace-card__badges {
    align-self: flex-end;
    margin-top: -34px;
  }
  .resource-count {
    align-items: flex-start;
    flex-direction: column;
  }
  .namespace-card__footer > span {
    display: none;
  }
  .namespace-card__footer .el-button {
    width: 100%;
  }
}
</style>
