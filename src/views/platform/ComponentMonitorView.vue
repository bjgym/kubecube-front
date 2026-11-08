<template>
  <div class="page page-stack">
    <PageHeader title="组件监控" description="查看 KubeCube 监控组件 Dashboard，点击进入完整监控视图。">
      <template #actions
        ><el-select
          v-model="selectedCluster"
          class="cluster-select"
          placeholder="选择管控集群"
          :loading="clusterLoading"
          @change="changeCluster"
          ><el-option
            v-for="cluster in controlClusters"
            :key="cluster.clusterName"
            :label="displayName(cluster)"
            :value="cluster.clusterName" /></el-select
        ><el-button :icon="Refresh" :loading="loading" @click="loadDashboards">刷新</el-button></template
      >
    </PageHeader>

    <section class="surface toolbar-surface">
      <div>
        <strong>组件 Dashboard</strong><span class="dashboard-count">{{ filteredDashboards.length }} / {{ dashboards.length }}</span>
      </div>
      <el-input v-model="keyword" :prefix-icon="Search" clearable placeholder="搜索组件名称或描述" class="search-input" />
    </section>
    <el-alert v-if="loadError" :title="loadError" type="error" show-icon :closable="false"
      ><template #default><el-button link type="primary" @click="loadDashboards">重新加载</el-button></template></el-alert
    >

    <div v-if="(loading || clusterLoading) && !dashboards.length" class="dashboard-grid">
      <el-skeleton v-for="index in 6" :key="index" class="surface dashboard-skeleton" animated :rows="3" />
    </div>
    <div v-else-if="filteredDashboards.length" v-loading="loading" class="dashboard-grid">
      <button
        v-for="dashboard in filteredDashboards"
        :key="dashboard.metadata.uid || dashboard.metadata.name"
        type="button"
        class="surface dashboard-card"
        @click="openDashboard(dashboard)"
      >
        <div class="dashboard-icon">
          <el-icon><DataAnalysis /></el-icon>
        </div>
        <div class="dashboard-content">
          <div class="dashboard-title">
            <h2>{{ dashboardTitle(dashboard) }}</h2>
            <el-icon class="arrow"><ArrowRight /></el-icon>
          </div>
          <code>{{ dashboard.metadata.name }}</code>
          <p>{{ dashboardDescription(dashboard) }}</p>
          <div v-if="dashboardLabels(dashboard).length" class="tag-list">
            <el-tag v-for="label in dashboardLabels(dashboard).slice(0, 3)" :key="label" size="small" effect="plain">{{ label }}</el-tag>
          </div>
        </div>
      </button>
    </div>
    <section v-else-if="!loading && !clusterLoading" class="surface">
      <EmptyState
        :title="dashboards.length ? '没有匹配的 Dashboard' : '暂无组件 Dashboard'"
        :description="
          dashboards.length ? '请调整搜索关键词。' : selectedCluster ? '当前管控集群未返回组件监控 Dashboard。' : '请先添加可用的管控集群。'
        "
        :action-text="dashboards.length ? '清空搜索' : ''"
        @action="keyword = ''"
      />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowRight, DataAnalysis, Refresh, Search } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { clusterApi } from '@/api/cluster'
import { monitorApi } from '@/api/observability'
import { useScopeStore } from '@/stores/scope'
import type { ClusterInfo, KubeResource } from '@/types/api'
import { asText, getByPath } from '@/utils/format'

const route = useRoute()
const router = useRouter()
const scope = useScopeStore()
const clusters = ref<ClusterInfo[]>([])
const dashboards = ref<KubeResource[]>([])
const selectedCluster = ref('')
const clusterLoading = ref(false)
const loading = ref(false)
const loadError = ref('')
const keyword = ref('')
let generation = 0
const controlClusters = computed(() => clusters.value.filter((item) => !item.isMemberCluster))
const filteredDashboards = computed(() => {
  const value = keyword.value.trim().toLowerCase()
  return value
    ? dashboards.value.filter((item) =>
        `${dashboardTitle(item)} ${item.metadata.name} ${dashboardDescription(item)}`.toLowerCase().includes(value),
      )
    : dashboards.value
})
function displayName(cluster: ClusterInfo) {
  return cluster.clusterDisplayName || cluster.annotations?.['cluster.kubecube.io/cn-name'] || cluster.clusterName
}
function dashboardTitle(item: KubeResource) {
  return asText(
    getByPath(item, 'spec.title') ||
      getByPath(item, 'spec.displayName') ||
      item.metadata.annotations?.['kubecube.io/display-name'] ||
      item.metadata.name,
  )
}
function dashboardDescription(item: KubeResource) {
  const value = getByPath(item, 'spec.description') || item.metadata.annotations?.['kubecube.io/description']
  return value ? asText(value) : '打开 Dashboard 查看该组件的实时指标与趋势。'
}
function dashboardLabels(item: KubeResource) {
  return Object.entries(item.metadata.labels || {}).map(([key, value]) => `${key}=${value}`)
}
function errorText(error: unknown) {
  return error instanceof Error ? error.message : '请求失败，请稍后重试'
}
async function loadClusters() {
  clusterLoading.value = true
  try {
    const response = await clusterApi.list({ prune: true })
    clusters.value = response.items || []
    const requested = String(route.query.cluster || '')
    selectedCluster.value = requested || scope.controlCluster || controlClusters.value[0]?.clusterName || ''
    if (selectedCluster.value) await loadDashboards()
  } catch (error) {
    loadError.value = `管控集群加载失败：${errorText(error)}`
  } finally {
    clusterLoading.value = false
  }
}
async function loadDashboards() {
  if (!selectedCluster.value) {
    loadError.value = '未找到可用管控集群，无法加载组件监控'
    return
  }
  const current = ++generation
  loading.value = true
  loadError.value = ''
  try {
    const response = (await monitorApi.componentDashboards(selectedCluster.value)) as { items?: KubeResource[] } | KubeResource[]
    if (current === generation) dashboards.value = Array.isArray(response) ? response : response.items || []
  } catch (error) {
    if (current === generation) loadError.value = `组件 Dashboard 加载失败：${errorText(error)}`
  } finally {
    if (current === generation) loading.value = false
  }
}
function changeCluster() {
  dashboards.value = []
  void router.replace({ query: { ...route.query, cluster: selectedCluster.value || undefined } })
  void loadDashboards()
}
function openDashboard(item: KubeResource) {
  router.push({ path: `/platform/monitor/${encodeURIComponent(item.metadata.name)}`, query: { cluster: selectedCluster.value } })
}
onMounted(loadClusters)
</script>

<style scoped>
.cluster-select {
  width: 210px;
}
.toolbar-surface {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
}
.dashboard-count {
  margin-left: 10px;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 400;
}
.search-input {
  width: 280px;
}
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}
.dashboard-card {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  min-width: 0;
  min-height: 200px;
  padding: 24px;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 160ms var(--ease),
    box-shadow 160ms var(--ease),
    transform 160ms var(--ease);
}
.dashboard-card:hover {
  border-color: var(--brand-200);
  box-shadow: var(--shadow-sm);
  transform: translateY(-2px);
}
.dashboard-icon {
  display: grid;
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
  color: var(--brand-600);
  background: var(--brand-50);
  border-radius: 11px;
  place-items: center;
  font-size: 22px;
}
.dashboard-content {
  min-width: 0;
  flex: 1;
}
.dashboard-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.dashboard-title h2 {
  overflow: hidden;
  font-size: 17px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.arrow {
  flex-shrink: 0;
  color: var(--text-tertiary);
}
.dashboard-content code {
  display: block;
  margin-top: 5px;
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dashboard-content p {
  display: -webkit-box;
  min-height: 42px;
  margin-top: 14px;
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 21px;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.tag-list {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 14px;
}
.tag-list .el-tag {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dashboard-skeleton {
  min-height: 200px;
  padding: 24px;
}
@media (max-width: 1150px) {
  .dashboard-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 700px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
  .toolbar-surface {
    align-items: stretch;
    flex-direction: column;
  }
  .search-input,
  .cluster-select {
    width: 100%;
  }
}
</style>
