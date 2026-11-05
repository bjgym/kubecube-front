<template>
  <div class="page page-stack">
    <PageHeader title="全局告警规则" description="按集群管理 kubecube-monitoring 空间中的 PrometheusRule。">
      <template #actions
        ><el-select
          v-model="selectedCluster"
          class="cluster-select"
          placeholder="选择集群"
          :loading="clusterLoading"
          @change="changeCluster"
          ><el-option
            v-for="cluster in clusters"
            :key="cluster.clusterName"
            :label="displayName(cluster)"
            :value="cluster.clusterName" /></el-select
        ><el-button :icon="Refresh" :loading="loading" @click="loadRules">刷新</el-button
        ><el-button type="primary" :icon="Plus" :disabled="!selectedCluster" @click="toCreate">创建告警规则</el-button></template
      >
    </PageHeader>

    <el-alert v-if="loadError" :title="loadError" type="error" show-icon :closable="false"
      ><template #default><el-button link type="primary" @click="loadRules">重新加载</el-button></template></el-alert
    >
    <el-alert v-if="deleteError" :title="deleteError" type="error" show-icon closable @close="deleteError = ''" />
    <section class="surface surface-padded">
      <div class="list-heading">
        <div>
          <h2>PrometheusRule 列表</h2>
          <p>命名空间固定为 <code>kubecube-monitoring</code>，规则变更直接提交到所选集群。</p>
        </div>
        <el-input v-model="keyword" clearable :prefix-icon="Search" placeholder="搜索规则名称" class="search-input" />
      </div>
      <el-table v-loading="loading || clusterLoading" :data="filteredRules" row-key="metadata.uid">
        <el-table-column label="告警规则名称" min-width="230" fixed="left"
          ><template #default="{ row }"
            ><router-link :to="editPath(row)">{{ row.metadata.name }}</router-link>
            <div class="cell-subtitle">{{ formatDate(row.metadata.creationTimestamp) }}</div></template
          ></el-table-column
        >
        <el-table-column label="规则组" width="105" align="center"
          ><template #default="{ row }">{{ groups(row).length }}</template></el-table-column
        >
        <el-table-column label="规则数量" width="105" align="center"
          ><template #default="{ row }">{{ ruleCount(row) }}</template></el-table-column
        >
        <el-table-column label="告警级别" min-width="200"
          ><template #default="{ row }"
            ><div v-if="severities(row).length" class="tag-list">
              <el-tag
                v-for="severity in severities(row)"
                :key="severity"
                :type="severity === 'critical' ? 'danger' : severity === 'warning' ? 'warning' : 'info'"
                effect="plain"
                >{{ severityLabel(severity) }}</el-tag
              >
            </div>
            <span v-else>—</span></template
          ></el-table-column
        >
        <el-table-column label="所属集群" min-width="160"
          ><template #default>{{ selectedCluster }}</template></el-table-column
        >
        <el-table-column label="操作" width="140" fixed="right"
          ><template #default="{ row }"
            ><el-button link type="primary" @click="router.push(editPath(row))">编辑</el-button
            ><el-button link type="danger" :loading="deletingName === row.metadata.name" @click="deleteRule(row)">删除</el-button></template
          ></el-table-column
        >
        <template #empty
          ><EmptyState
            v-if="!loading && !clusterLoading && !loadError"
            :title="rules.length ? '没有匹配的告警规则' : '暂无全局告警规则'"
            :description="
              rules.length ? '请调整搜索关键词。' : selectedCluster ? '当前集群还没有全局告警规则，可创建第一条规则。' : '请先选择集群。'
            "
            :action-text="rules.length ? '清空搜索' : selectedCluster ? '创建告警规则' : ''"
            @action="rules.length ? (keyword = '') : toCreate()"
        /></template>
      </el-table>
      <div v-if="filteredRules.length" class="list-count text-secondary">
        共 {{ filteredRules.length }} 个 PrometheusRule，{{ totalRuleCount }} 条 group/rule 配置
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh, Search } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { clusterApi } from '@/api/cluster'
import { resourceApi, type ResourceDefinition } from '@/api/resource'
import { useScopeStore } from '@/stores/scope'
import type { ClusterInfo, KubeResource } from '@/types/api'
import { formatDate } from '@/utils/format'

interface RuleGroup {
  rules?: Array<{ labels?: Record<string, string> }>
}
const namespace = 'kubecube-monitoring'
const definition: ResourceDefinition = {
  plural: 'prometheusrules',
  kind: 'PrometheusRule',
  group: 'monitoring.coreos.com',
  version: 'v1',
  namespaced: true,
}
const route = useRoute()
const router = useRouter()
const scope = useScopeStore()
const clusters = ref<ClusterInfo[]>([])
const rules = ref<KubeResource[]>([])
const selectedCluster = ref('')
const clusterLoading = ref(false)
const loading = ref(false)
const loadError = ref('')
const deleteError = ref('')
const deletingName = ref('')
const keyword = ref('')
let generation = 0
const filteredRules = computed(() => {
  const value = keyword.value.trim().toLowerCase()
  return value ? rules.value.filter((item) => item.metadata.name.toLowerCase().includes(value)) : rules.value
})
const totalRuleCount = computed(() => filteredRules.value.reduce((sum, item) => sum + ruleCount(item), 0))
function displayName(cluster: ClusterInfo) {
  return cluster.clusterDisplayName || cluster.annotations?.['cluster.kubecube.io/cn-name'] || cluster.clusterName
}
function groups(item: KubeResource) {
  const spec = item.spec as Record<string, unknown> | undefined
  return (spec?.groups as RuleGroup[] | undefined) || []
}
function ruleCount(item: KubeResource) {
  return groups(item).reduce((sum, group) => sum + (group.rules?.length || 0), 0)
}
function severities(item: KubeResource) {
  return [
    ...new Set(
      groups(item).flatMap((group) =>
        (group.rules || []).map((rule) => rule.labels?.severity).filter((value): value is string => Boolean(value)),
      ),
    ),
  ]
}
function severityLabel(value: string) {
  return ({ info: '轻微', warning: '一般', critical: '紧急' } as Record<string, string>)[value] || value
}
function errorText(error: unknown) {
  return error instanceof Error ? error.message : '请求失败，请稍后重试'
}
function editPath(item: KubeResource) {
  return `/platform/PrometheusRule/${encodeURIComponent(selectedCluster.value)}/${encodeURIComponent(item.metadata.name)}/edit`
}
function toCreate() {
  if (selectedCluster.value) router.push(`/platform/PrometheusRule/${encodeURIComponent(selectedCluster.value)}/create`)
}
async function loadClusters() {
  clusterLoading.value = true
  loadError.value = ''
  try {
    const response = await clusterApi.list({ prune: true })
    clusters.value = response.items || []
    const requested = String(route.query.cluster || '')
    selectedCluster.value = clusters.value.some((item) => item.clusterName === requested)
      ? requested
      : scope.cluster || scope.controlCluster || clusters.value[0]?.clusterName || ''
    if (selectedCluster.value) await loadRules()
  } catch (error) {
    loadError.value = `集群列表加载失败：${errorText(error)}`
  } finally {
    clusterLoading.value = false
  }
}
async function loadRules() {
  if (!selectedCluster.value) return
  const current = ++generation
  loading.value = true
  loadError.value = ''
  try {
    const response = await resourceApi.list(definition, { cluster: selectedCluster.value, namespace }, { pageNum: 1, pageSize: 1000 })
    if (current === generation) rules.value = response.items || []
  } catch (error) {
    if (current === generation) loadError.value = `告警规则加载失败：${errorText(error)}`
  } finally {
    if (current === generation) loading.value = false
  }
}
function changeCluster() {
  rules.value = []
  keyword.value = ''
  void router.replace({ query: { ...route.query, cluster: selectedCluster.value || undefined } })
  void loadRules()
}
async function deleteRule(item: KubeResource) {
  try {
    await ElMessageBox.confirm(
      `确认删除集群“${selectedCluster.value}”中的告警规则“${item.metadata.name}”吗？删除后 Prometheus 将不再加载该配置。`,
      '删除告警规则',
      { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消', confirmButtonClass: 'el-button--danger' },
    )
  } catch {
    return
  }
  deletingName.value = item.metadata.name
  deleteError.value = ''
  try {
    await resourceApi.delete(definition, { cluster: selectedCluster.value, namespace, name: item.metadata.name })
    ElMessage.success('告警规则已删除')
    await loadRules()
  } catch (error) {
    deleteError.value = `删除失败：${errorText(error)}`
  } finally {
    deletingName.value = ''
  }
}
onMounted(loadClusters)
</script>

<style scoped>
.cluster-select {
  width: 200px;
}
.list-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 20px;
}
.list-heading h2 {
  font-size: 17px;
}
.list-heading p {
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 12px;
}
.search-input {
  width: 260px;
  flex-shrink: 0;
}
.cell-subtitle {
  margin-top: 3px;
  color: var(--text-secondary);
  font-size: 12px;
}
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.list-count {
  margin-top: 14px;
  text-align: right;
  font-size: 13px;
}
@media (max-width: 700px) {
  .cluster-select,
  .search-input {
    width: 100%;
  }
  .list-heading {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
