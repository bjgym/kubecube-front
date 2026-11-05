<template>
  <div class="page page-stack">
    <PageHeader title="租户配额" description="查看各租户在业务集群中的 CPU、内存与 GPU 请求/上限配额。">
      <template #actions><el-button :icon="Refresh" :loading="loading" @click="loadData">刷新</el-button></template>
    </PageHeader>

    <section class="surface filter-bar">
      <div class="filter-item">
        <span>租户</span
        ><el-select v-model="tenantFilter" clearable placeholder="全部租户" class="filter-select"
          ><el-option
            v-for="tenant in tenants"
            :key="tenant.metadata.name"
            :label="tenantDisplayName(tenant)"
            :value="tenant.metadata.name"
        /></el-select>
      </div>
      <div class="filter-item">
        <span>集群</span
        ><el-select v-model="clusterFilter" clearable placeholder="全部集群" class="filter-select"
          ><el-option
            v-for="cluster in clusters"
            :key="cluster.clusterName"
            :label="clusterDisplayName(cluster)"
            :value="cluster.clusterName"
        /></el-select>
      </div>
      <el-input v-model="keyword" clearable :prefix-icon="Search" placeholder="搜索租户或集群标识" class="keyword-input" />
    </section>

    <el-alert v-if="loadError" :title="loadError" type="error" show-icon :closable="false"
      ><template #default><el-button link type="primary" @click="loadData">重新加载</el-button></template></el-alert
    >
    <div class="result-summary text-secondary">
      <span>共 {{ filteredRows.length }} 组租户 / 集群配额</span><span>已配置 {{ configuredCount }} 组</span>
    </div>

    <div v-if="loading && !rows.length" class="quota-grid">
      <el-skeleton v-for="index in 3" :key="index" class="surface quota-skeleton" animated :rows="7" />
    </div>
    <div v-else-if="filteredRows.length" v-loading="loading" class="quota-grid">
      <section v-for="row in filteredRows" :key="row.key" class="surface quota-card">
        <header class="quota-card__header">
          <div>
            <h2>{{ row.tenantDisplayName }}</h2>
            <p>{{ row.tenant }} · {{ row.clusterDisplayName }}</p>
          </div>
          <StatusTag :status="row.quota ? 'Active' : 'Unknown'" :label="row.quota ? '已配置' : '未配置'" />
        </header>
        <div class="cluster-line">
          <span>集群标识</span><code>{{ row.cluster }}</code>
        </div>
        <div v-for="resource in resources" :key="resource.key" class="resource-block">
          <h3>{{ resource.label }}</h3>
          <div class="quota-line">
            <span>Request</span><strong>{{ resourceValue(row.quota, resource.requestKey, resource.kind, false) }}</strong>
          </div>
          <div class="used-line">已分配 {{ resourceValue(row.quota, resource.requestKey, resource.kind, true) }}</div>
          <el-progress :percentage="usagePercent(row.quota, resource.requestKey, resource.kind)" :show-text="false" :stroke-width="5" />
          <div v-if="resource.limitKey" class="quota-line">
            <span>Limit</span><strong>{{ resourceValue(row.quota, resource.limitKey, resource.kind, false) }}</strong>
          </div>
          <div v-if="resource.limitKey" class="used-line">
            已分配 {{ resourceValue(row.quota, resource.limitKey, resource.kind, true) }}
          </div>
          <el-progress
            v-if="resource.limitKey"
            :percentage="usagePercent(row.quota, resource.limitKey, resource.kind)"
            :show-text="false"
            :stroke-width="5"
          />
        </div>
        <footer>
          <el-button type="primary" plain @click="openEditor(row)">{{ row.quota ? '调整配额' : '配置配额' }}</el-button>
        </footer>
      </section>
    </div>
    <section v-else-if="!loading" class="surface">
      <EmptyState
        :title="rows.length ? '没有匹配的配额' : '暂无租户配额'"
        :description="rows.length ? '请调整租户、集群或关键词筛选。' : '请确认已创建租户并添加业务集群。'"
        :action-text="hasFilters ? '清空筛选' : ''"
        @action="clearFilters"
      />
    </section>

    <el-dialog
      v-model="editorVisible"
      :title="editingRow?.quota ? '调整租户配额' : '配置租户配额'"
      width="min(720px, 95vw)"
      :close-on-click-modal="false"
    >
      <div v-if="editingRow" class="editor-target">
        <div>
          <span>租户</span><strong>{{ editingRow.tenantDisplayName }}（{{ editingRow.tenant }}）</strong>
        </div>
        <div>
          <span>集群</span><strong>{{ editingRow.clusterDisplayName }}（{{ editingRow.cluster }}）</strong>
        </div>
      </div>
      <el-alert
        title="配额下限不能小于当前已分配量；提交后由 Kubernetes 准入校验最终确认。"
        type="info"
        :closable="false"
        class="editor-notice"
      />
      <div class="editor-grid">
        <el-form label-position="top"
          ><h3>
            CPU（Cores）<small>{{ capacityHint('cpu', 'requests.cpu') }}</small>
          </h3>
          <el-form-item label="Request 配额"
            ><el-input-number v-model="form.requestsCpu" :min="0" :precision="2" :step="1" controls-position="right" /></el-form-item
          ><el-form-item label="Limit 配额"
            ><el-input-number v-model="form.limitsCpu" :min="0" :precision="2" :step="1" controls-position="right" /></el-form-item
        ></el-form>
        <el-form label-position="top"
          ><h3>
            内存（GiB）<small>{{ capacityHint('memory', 'requests.memory') }}</small>
          </h3>
          <el-form-item label="Request 配额"
            ><el-input-number v-model="form.requestsMemory" :min="0" :precision="2" :step="1" controls-position="right" /></el-form-item
          ><el-form-item label="Limit 配额"
            ><el-input-number v-model="form.limitsMemory" :min="0" :precision="2" :step="1" controls-position="right" /></el-form-item
        ></el-form>
        <el-form label-position="top"
          ><h3>
            NVIDIA GPU（卡）<small>{{ capacityHint('gpu', 'requests.nvidia.com/gpu') }}</small>
          </h3>
          <el-form-item label="Request 配额"
            ><el-input-number v-model="form.requestsGpu" :min="0" :precision="0" :step="1" controls-position="right" /></el-form-item
          ><el-form-item label="Limit 配额"
            ><el-input-number v-model="form.limitsGpu" :min="0" :precision="0" :step="1" controls-position="right" /></el-form-item
        ></el-form>
        <el-form label-position="top"
          ><h3>
            存储（GiB）<small>{{ capacityHint('storage', 'requests.storage') }}</small>
          </h3>
          <el-form-item label="Request 配额"
            ><el-input-number v-model="form.requestsStorage" :min="0" :precision="2" :step="10" controls-position="right" /></el-form-item
        ></el-form>
      </div>
      <el-alert v-if="submitError" :title="submitError" type="error" show-icon :closable="false" />
      <template #footer
        ><el-button @click="editorVisible = false">取消</el-button
        ><el-button type="primary" :loading="submitting" @click="submitQuota">保存配额</el-button></template
      >
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, Search } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import { clusterApi } from '@/api/cluster'
import { scopeApi } from '@/api/scope'
import { useScopeStore } from '@/stores/scope'
import type { ClusterInfo, KubeResource } from '@/types/api'
import { formatNumber } from '@/utils/format'

type ResourceKind = 'cpu' | 'memory' | 'gpu' | 'storage'
interface QuotaRow {
  key: string
  tenant: string
  tenantDisplayName: string
  cluster: string
  clusterDisplayName: string
  clusterInfo?: ClusterInfo
  quota?: KubeResource
}
interface QuotaForm {
  requestsCpu: number
  limitsCpu: number
  requestsMemory: number
  limitsMemory: number
  requestsGpu: number
  limitsGpu: number
  requestsStorage: number
}
const resources: Array<{ key: string; label: string; requestKey: string; limitKey?: string; kind: ResourceKind }> = [
  { key: 'cpu', label: 'CPU', requestKey: 'requests.cpu', limitKey: 'limits.cpu', kind: 'cpu' },
  { key: 'memory', label: '内存', requestKey: 'requests.memory', limitKey: 'limits.memory', kind: 'memory' },
  { key: 'gpu', label: 'NVIDIA GPU', requestKey: 'requests.nvidia.com/gpu', limitKey: 'limits.nvidia.com/gpu', kind: 'gpu' },
  { key: 'storage', label: '存储', requestKey: 'requests.storage', kind: 'storage' },
]
const scope = useScopeStore()
const clusters = ref<ClusterInfo[]>([])
const tenants = ref<KubeResource[]>([])
const quotas = ref<KubeResource[]>([])
const loading = ref(false)
const loadError = ref('')
const tenantFilter = ref('')
const clusterFilter = ref('')
const keyword = ref('')
const editorVisible = ref(false)
const editingRow = ref<QuotaRow>()
const submitting = ref(false)
const submitError = ref('')
const form = reactive<QuotaForm>({
  requestsCpu: 0,
  limitsCpu: 0,
  requestsMemory: 0,
  limitsMemory: 0,
  requestsGpu: 0,
  limitsGpu: 0,
  requestsStorage: 0,
})
const controlCluster = computed(() => scope.controlCluster || clusters.value.find((item) => !item.isMemberCluster)?.clusterName || '')
const quotaMap = computed(() => new Map(quotas.value.map((item) => [item.metadata.name, item])))
const rows = computed<QuotaRow[]>(() =>
  tenants.value.flatMap((tenant) =>
    clusters.value.map((cluster) => {
      const tenantName = tenant.metadata.name
      const clusterName = cluster.clusterName
      const name = `${clusterName}.${tenantName}`
      return {
        key: name,
        tenant: tenantName,
        tenantDisplayName: tenantDisplayName(tenant),
        cluster: clusterName,
        clusterDisplayName: clusterDisplayName(cluster),
        clusterInfo: cluster,
        quota: quotaMap.value.get(name),
      }
    }),
  ),
)
const filteredRows = computed(() =>
  rows.value.filter(
    (row) =>
      (!tenantFilter.value || row.tenant === tenantFilter.value) &&
      (!clusterFilter.value || row.cluster === clusterFilter.value) &&
      (!keyword.value.trim() ||
        `${row.tenantDisplayName} ${row.tenant} ${row.clusterDisplayName} ${row.cluster}`
          .toLowerCase()
          .includes(keyword.value.trim().toLowerCase())),
  ),
)
const configuredCount = computed(() => filteredRows.value.filter((row) => row.quota).length)
const hasFilters = computed(() => Boolean(tenantFilter.value || clusterFilter.value || keyword.value))
function tenantDisplayName(tenant: KubeResource) {
  const spec = tenant.spec as Record<string, unknown> | undefined
  return String(spec?.displayName || tenant.metadata.name)
}
function clusterDisplayName(cluster: ClusterInfo) {
  return cluster.clusterDisplayName || cluster.annotations?.['cluster.kubecube.io/cn-name'] || cluster.clusterName
}
function errorText(error: unknown) {
  return error instanceof Error ? error.message : '请求失败，请稍后重试'
}
function specHard(quota: KubeResource | undefined) {
  const spec = quota?.spec as Record<string, unknown> | undefined
  return (spec?.hard || {}) as Record<string, unknown>
}
function statusMap(quota: KubeResource | undefined, key: 'hard' | 'used') {
  const status = quota?.status as Record<string, unknown> | undefined
  return (status?.[key] || {}) as Record<string, unknown>
}
function rawValue(quota: KubeResource | undefined, key: string, used: boolean) {
  return used ? (statusMap(quota, 'used')[key] ?? 0) : (statusMap(quota, 'hard')[key] ?? specHard(quota)[key])
}
function numberValue(value: unknown, kind: ResourceKind) {
  if (value === undefined || value === null || value === '') return 0
  const source = String(value).trim()
  const match = source.match(/^([+-]?(?:\d+\.?\d*|\.\d+))([a-zA-Z]*)$/)
  if (!match) return 0
  const valueNumber = Number(match[1])
  const suffix = match[2] || ''
  if (!Number.isFinite(valueNumber)) return 0
  if (kind === 'cpu' || kind === 'gpu') return suffix === 'm' ? valueNumber / 1000 : valueNumber
  const factors: Record<string, number> = {
    '': 1 / 1024 ** 3,
    Ki: 1 / 1024 ** 2,
    Mi: 1 / 1024,
    Gi: 1,
    Ti: 1024,
    Pi: 1024 ** 2,
    K: 1000 / 1024 ** 3,
    M: 1000 ** 2 / 1024 ** 3,
    G: 1000 ** 3 / 1024 ** 3,
  }
  return valueNumber * (factors[suffix] ?? 1)
}
function resourceValue(quota: KubeResource | undefined, key: string, kind: ResourceKind, used: boolean) {
  if (!quota) return '未配置'
  const value = rawValue(quota, key, used)
  if (value === undefined || value === null || value === '') return '—'
  const unit = kind === 'memory' || kind === 'storage' ? 'GiB' : kind === 'gpu' ? '卡' : 'Cores'
  return `${formatNumber(numberValue(value, kind), 2)} ${unit}`
}
function capacityHint(kind: ResourceKind, key: string) {
  if (!editingRow.value) return ''
  const allocated = resourceValue(editingRow.value.quota, key, kind, true)
  const info = editingRow.value.clusterInfo
  const total =
    kind === 'cpu' && info?.totalCpu
      ? `集群总量 ${formatNumber(info.totalCpu)} Cores`
      : kind === 'memory' && info?.totalMem
        ? `集群总量 ${formatNumber(info.totalMem / 1024)} GiB`
        : ''
  return `已分配 ${allocated}${total ? ` · ${total}` : ''}`
}
function usagePercent(quota: KubeResource | undefined, key: string, kind: ResourceKind) {
  const hard = numberValue(rawValue(quota, key, false), kind)
  const used = numberValue(rawValue(quota, key, true), kind)
  return hard > 0 ? Math.min(100, Math.max(0, Math.round((used / hard) * 100))) : 0
}
async function loadData() {
  loading.value = true
  loadError.value = ''
  try {
    const clusterResponse = await clusterApi.list({ prune: true })
    clusters.value = clusterResponse.items || []
    if (!controlCluster.value) throw new Error('未找到管控集群，无法读取租户配额')
    const [tenantResponse, quotaResponse] = await Promise.all([
      scopeApi.list(controlCluster.value, 'tenants'),
      scopeApi.quotas(controlCluster.value),
    ])
    tenants.value = tenantResponse.items || []
    quotas.value = quotaResponse.items || []
  } catch (error) {
    loadError.value = `配额数据加载失败：${errorText(error)}`
  } finally {
    loading.value = false
  }
}
function openEditor(row: QuotaRow) {
  editingRow.value = row
  const hard = { ...specHard(row.quota), ...statusMap(row.quota, 'hard') }
  Object.assign(form, {
    requestsCpu: numberValue(hard['requests.cpu'], 'cpu'),
    limitsCpu: numberValue(hard['limits.cpu'], 'cpu'),
    requestsMemory: numberValue(hard['requests.memory'], 'memory'),
    limitsMemory: numberValue(hard['limits.memory'], 'memory'),
    requestsGpu: numberValue(hard['requests.nvidia.com/gpu'], 'gpu'),
    limitsGpu: numberValue(hard['limits.nvidia.com/gpu'], 'gpu'),
    requestsStorage: numberValue(hard['requests.storage'], 'storage'),
  })
  submitError.value = ''
  editorVisible.value = true
}
async function submitQuota() {
  const row = editingRow.value
  if (!row || !controlCluster.value) return
  submitting.value = true
  submitError.value = ''
  const value = (input: number) => (Number.isFinite(Number(input)) ? Number(input) : 0)
  const hard = {
    'requests.cpu': String(value(form.requestsCpu)),
    'limits.cpu': String(value(form.limitsCpu)),
    'requests.memory': `${value(form.requestsMemory)}Gi`,
    'limits.memory': `${value(form.limitsMemory)}Gi`,
    'requests.nvidia.com/gpu': String(value(form.requestsGpu)),
    'limits.nvidia.com/gpu': String(value(form.limitsGpu)),
    'requests.storage': `${value(form.requestsStorage)}Gi`,
  }
  try {
    if (row.quota) await scopeApi.patchQuota(controlCluster.value, row.quota.metadata.name, { spec: { hard } })
    else
      await scopeApi.createQuota(controlCluster.value, {
        apiVersion: 'quota.kubecube.io/v1',
        kind: 'CubeResourceQuota',
        metadata: {
          name: row.key,
          labels: { 'kubecube.io/cluster': row.cluster, 'kubecube.io/tenant': row.tenant },
          annotations: { 'kubecube.io/sync': 'true' },
        },
        spec: { hard, target: { name: row.tenant, kind: 'Tenant' } },
      })
    ElMessage.success('配额已保存')
    editorVisible.value = false
    await loadData()
  } catch (error) {
    submitError.value = errorText(error)
  } finally {
    submitting.value = false
  }
}
function clearFilters() {
  tenantFilter.value = ''
  clusterFilter.value = ''
  keyword.value = ''
}
onMounted(loadData)
</script>

<style scoped>
.filter-bar {
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
  padding: 16px 20px;
}
.filter-item {
  display: flex;
  align-items: center;
  gap: 8px;
}
.filter-item > span {
  color: var(--text-secondary);
  white-space: nowrap;
}
.filter-select {
  width: 200px;
}
.keyword-input {
  width: 260px;
  margin-left: auto;
}
.result-summary {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  font-size: 13px;
}
.quota-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}
.quota-card {
  display: flex;
  min-width: 0;
  padding: 22px;
  flex-direction: column;
}
.quota-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.quota-card__header h2 {
  overflow: hidden;
  font-size: 17px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.quota-card__header p {
  margin-top: 5px;
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cluster-line {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin: 18px 0 6px;
  padding: 9px 11px;
  color: var(--text-secondary);
  background: var(--surface-subtle);
  border-radius: 7px;
  font-size: 12px;
}
.cluster-line code {
  overflow: hidden;
  color: var(--text-regular);
  text-overflow: ellipsis;
}
.resource-block {
  padding: 14px 0 8px;
  border-bottom: 1px solid var(--border-light);
}
.resource-block h3 {
  margin-bottom: 10px;
  font-size: 13px;
}
.quota-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 9px;
  font-size: 13px;
}
.quota-line span {
  color: var(--text-secondary);
}
.quota-line strong {
  font-weight: 550;
  text-align: right;
}
.used-line {
  margin: 3px 0 5px;
  color: var(--text-tertiary);
  font-size: 11px;
  text-align: right;
}
.el-progress {
  margin-bottom: 5px;
}
.quota-card footer {
  margin-top: auto;
  padding-top: 18px;
  text-align: right;
}
.quota-skeleton {
  min-height: 480px;
  padding: 24px;
}
.editor-target {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 18px;
}
.editor-target div {
  padding: 12px;
  background: var(--surface-subtle);
  border-radius: 8px;
}
.editor-target span {
  display: block;
  margin-bottom: 4px;
  color: var(--text-secondary);
  font-size: 12px;
}
.editor-notice {
  margin-bottom: 20px;
}
.editor-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  margin-bottom: 20px;
}
.editor-grid h3 {
  margin-bottom: 14px;
  font-size: 14px;
}
.editor-grid h3 small {
  display: block;
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 400;
}
.editor-grid .el-input-number {
  width: 100%;
}
@media (max-width: 1250px) {
  .quota-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 760px) {
  .filter-bar {
    align-items: stretch;
    flex-direction: column;
    gap: 12px;
  }
  .filter-item {
    justify-content: space-between;
  }
  .filter-select,
  .keyword-input {
    width: 100%;
    margin-left: 0;
  }
  .quota-grid,
  .editor-grid {
    grid-template-columns: 1fr;
  }
  .editor-grid {
    gap: 4px;
  }
}
@media (max-width: 520px) {
  .editor-target {
    grid-template-columns: 1fr;
  }
  .result-summary {
    flex-direction: column;
    gap: 4px;
  }
}
</style>
