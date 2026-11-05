<template>
  <div class="page page-stack">
    <PageHeader title="空间管理" description="跨集群管理空间的归属、资源配额与元信息。">
      <template #actions
        ><el-button :icon="Refresh" :loading="loading" @click="loadData">刷新</el-button
        ><el-button type="primary" :icon="Plus" @click="openCreate">创建空间</el-button></template
      >
    </PageHeader>

    <section class="surface filter-bar">
      <el-select v-model="clusterFilter" clearable placeholder="全部集群" class="filter-control"
        ><el-option
          v-for="cluster in clusters"
          :key="cluster.clusterName"
          :label="clusterDisplayName(cluster)"
          :value="cluster.clusterName"
      /></el-select>
      <el-select v-model="tenantFilter" clearable placeholder="全部租户" class="filter-control"
        ><el-option v-for="tenant in tenants" :key="tenant.metadata.name" :label="displayName(tenant)" :value="tenant.metadata.name"
      /></el-select>
      <el-select v-model="manageFilter" clearable placeholder="全部纳管状态" class="filter-control small"
        ><el-option label="已纳管" value="managed" /><el-option label="未纳管" value="unmanaged"
      /></el-select>
      <el-input v-model="keyword" clearable :prefix-icon="Search" placeholder="搜索空间、项目或标识" class="keyword-input" />
    </section>
    <el-alert v-if="loadError" :title="loadError" type="error" show-icon :closable="false"
      ><template #default><el-button link type="primary" @click="loadData">重新加载</el-button></template></el-alert
    >

    <section class="surface surface-padded">
      <div class="list-heading">
        <h2>
          空间列表 <span>{{ filteredRows.length }}</span>
        </h2>
        <p>未纳管空间只能选择纳管或修改元信息，删除前需输入完整空间名称。</p>
      </div>
      <el-table v-loading="loading" :data="filteredRows" row-key="key">
        <el-table-column label="空间" min-width="190" fixed="left"
          ><template #default="{ row }"
            ><strong>{{ row.namespace }}</strong>
            <div class="cell-subtitle">{{ formatDate(row.creationTimestamp) }}</div></template
          ></el-table-column
        >
        <el-table-column label="集群" min-width="170"
          ><template #default="{ row }"
            ><router-link :to="`/platform/cluster/${encodeURIComponent(row.cluster)}/info`">{{ row.clusterDisplayName }}</router-link>
            <div class="cell-subtitle">{{ row.cluster }}</div></template
          ></el-table-column
        >
        <el-table-column label="纳管状态" width="110"
          ><template #default="{ row }"
            ><StatusTag :status="row.unmanaged ? 'Unknown' : 'Active'" :label="row.unmanaged ? '未纳管' : '已纳管'" /></template
        ></el-table-column>
        <el-table-column label="租户" min-width="150"
          ><template #default="{ row }">{{ tenantName(row.tenant) }}</template></el-table-column
        >
        <el-table-column label="项目" min-width="150"
          ><template #default="{ row }">{{ projectName(row.project) }}</template></el-table-column
        >
        <el-table-column label="状态" width="105"
          ><template #default="{ row }"><StatusTag :status="row.status" /></template
        ></el-table-column>
        <el-table-column label="配额（已用 / 上限）" min-width="245"
          ><template #default="{ row }">
            <div v-if="row.quota" class="quota-cell">
              <span v-for="entry in quotaSummary(row)" :key="entry.key">
                <strong>{{ entry.label }}</strong> {{ entry.value }}
              </span>
            </div>
            <span v-else class="text-tertiary">{{ row.unmanaged ? '未纳管' : '未配置' }}</span>
          </template></el-table-column
        >
        <el-table-column label="操作" width="275" fixed="right"
          ><template #default="{ row }">
            <el-button v-if="row.unmanaged" link type="primary" @click="openOnboard(row)">纳管</el-button>
            <el-button v-else link type="primary" @click="openQuota(row)">编辑配额</el-button>
            <el-button link type="primary" @click="openMetadata(row)">元信息</el-button>
            <el-tooltip :disabled="!row.isFederateMember" content="联邦成员空间由管控集群统一管理"
              ><span
                ><el-button link type="danger" :disabled="row.unmanaged || row.isFederateMember" @click="openDelete(row)"
                  >删除</el-button
                ></span
              ></el-tooltip
            >
          </template></el-table-column
        >
        <template #empty
          ><EmptyState
            v-if="!loading && !loadError"
            :title="rows.length ? '没有匹配的空间' : '暂无空间'"
            :description="rows.length ? '请调整筛选条件后重试。' : '点击“创建空间”开始配置业务空间。'"
            :action-text="rows.length ? '清空筛选' : '创建空间'"
            @action="rows.length ? clearFilters() : openCreate()"
        /></template>
      </el-table>
    </section>

    <el-dialog
      v-model="spaceDialogVisible"
      :title="spaceMode === 'create' ? '创建空间' : '纳管空间'"
      width="min(780px, 95vw)"
      :close-on-click-modal="false"
    >
      <el-alert
        v-if="spaceMode === 'onboard'"
        title="纳管后，空间内已有资源将纳入所选项目的权限与配额管理；删除项目时该空间也可能被一并删除。"
        type="warning"
        show-icon
        :closable="false"
        class="dialog-notice"
      />
      <el-form ref="spaceFormRef" :model="spaceForm" :rules="spaceRules" label-width="105px">
        <div class="form-grid">
          <el-form-item label="集群" prop="cluster"
            ><el-select v-model="spaceForm.cluster" :disabled="spaceMode === 'onboard'" placeholder="选择集群"
              ><el-option
                v-for="cluster in clusters"
                :key="cluster.clusterName"
                :label="clusterDisplayName(cluster)"
                :value="cluster.clusterName" /></el-select
          ></el-form-item>
          <el-form-item label="空间名称" prop="namespace"
            ><el-input v-model="spaceForm.namespace" :disabled="spaceMode === 'onboard'" placeholder="小写字母、数字或中划线"
          /></el-form-item>
          <el-form-item label="租户" prop="tenant"
            ><el-select v-model="spaceForm.tenant" placeholder="选择租户" @change="spaceForm.project = ''"
              ><el-option
                v-for="tenant in tenants"
                :key="tenant.metadata.name"
                :label="displayName(tenant)"
                :value="tenant.metadata.name" /></el-select
          ></el-form-item>
          <el-form-item label="关联项目" prop="project"
            ><el-select v-model="spaceForm.project" placeholder="选择项目" :disabled="!spaceForm.tenant"
              ><el-option
                v-for="project in availableProjects"
                :key="project.metadata.name"
                :label="displayName(project)"
                :value="project.metadata.name" /></el-select
          ></el-form-item>
        </div>
        <el-divider content-position="left">初始资源配额</el-divider>
        <p class="form-help">CPU 单位为 Cores，内存和存储单位为 GiB；0 表示不设置该项限制。</p>
        <div class="quota-form-grid">
          <el-form-item label="CPU Request"
            ><el-input-number v-model="spaceForm.requestsCpu" :min="0" :precision="2" controls-position="right" /></el-form-item
          ><el-form-item label="CPU Limit"
            ><el-input-number v-model="spaceForm.limitsCpu" :min="0" :precision="2" controls-position="right" /></el-form-item
          ><el-form-item label="内存 Request"
            ><el-input-number v-model="spaceForm.requestsMemory" :min="0" :precision="2" controls-position="right" /></el-form-item
          ><el-form-item label="内存 Limit"
            ><el-input-number v-model="spaceForm.limitsMemory" :min="0" :precision="2" controls-position="right" /></el-form-item
          ><el-form-item label="GPU Request"
            ><el-input-number v-model="spaceForm.requestsGpu" :min="0" :precision="0" controls-position="right" /></el-form-item
          ><el-form-item label="GPU Limit"
            ><el-input-number v-model="spaceForm.limitsGpu" :min="0" :precision="0" controls-position="right" /></el-form-item
          ><el-form-item label="存储 Request"
            ><el-input-number v-model="spaceForm.requestsStorage" :min="0" :precision="2" controls-position="right"
          /></el-form-item>
        </div>
      </el-form>
      <el-alert v-if="submitError" :title="submitError" type="error" show-icon :closable="false" />
      <template #footer
        ><el-button @click="spaceDialogVisible = false">取消</el-button
        ><el-button type="primary" :loading="submitting" @click="submitSpace">{{
          spaceMode === 'create' ? '创建空间' : '确认纳管'
        }}</el-button></template
      >
    </el-dialog>

    <el-dialog
      v-model="quotaDialogVisible"
      :title="existingQuota ? '编辑空间配额' : '为空间补建配额'"
      width="min(720px, 95vw)"
      :close-on-click-modal="false"
    >
      <div class="dialog-target">
        空间：<strong>{{ quotaRow?.namespace }}</strong
        ><span>集群：{{ quotaRow?.cluster }}</span>
      </div>
      <el-skeleton v-if="quotaLoading" animated :rows="5" />
      <template v-else>
        <el-alert v-if="quotaLoadError" :title="quotaLoadError" type="error" show-icon :closable="false" class="dialog-notice"
          ><template #default><el-button link type="primary" @click="loadQuota">重试</el-button></template></el-alert
        >
        <template v-else
          ><el-alert
            :title="existingQuota ? '正在编辑已存在的 ResourceQuota。' : '未找到该空间的标准 ResourceQuota，保存时将真实创建。'"
            :type="existingQuota ? 'info' : 'warning'"
            :closable="false"
            class="dialog-notice" />
          <p class="form-help">编辑时设为 0 会移除对应配额项；Kubernetes 会校验新配额不得小于当前用量。</p>
          <div class="quota-form-grid quota-edit-grid">
            <label
              >CPU Request（Cores）<el-input-number
                v-model="quotaForm.requestsCpu"
                :min="0"
                :precision="2"
                controls-position="right" /></label
            ><label
              >CPU Limit（Cores）<el-input-number v-model="quotaForm.limitsCpu" :min="0" :precision="2" controls-position="right" /></label
            ><label
              >内存 Request（GiB）<el-input-number
                v-model="quotaForm.requestsMemory"
                :min="0"
                :precision="2"
                controls-position="right" /></label
            ><label
              >内存 Limit（GiB）<el-input-number
                v-model="quotaForm.limitsMemory"
                :min="0"
                :precision="2"
                controls-position="right" /></label
            ><label
              >GPU Request（卡）<el-input-number v-model="quotaForm.requestsGpu" :min="0" :precision="0" controls-position="right" /></label
            ><label
              >GPU Limit（卡）<el-input-number v-model="quotaForm.limitsGpu" :min="0" :precision="0" controls-position="right" /></label
            ><label
              >存储 Request（GiB）<el-input-number v-model="quotaForm.requestsStorage" :min="0" :precision="2" controls-position="right"
            /></label></div
        ></template>
      </template>
      <el-alert v-if="submitError" :title="submitError" type="error" show-icon :closable="false" />
      <template #footer
        ><el-button @click="quotaDialogVisible = false">取消</el-button
        ><el-button type="primary" :loading="submitting" :disabled="quotaLoading || Boolean(quotaLoadError)" @click="submitQuota"
          >保存配额</el-button
        ></template
      >
    </el-dialog>

    <el-dialog v-model="metadataDialogVisible" title="修改空间元信息" width="min(820px, 95vw)" :close-on-click-modal="false">
      <div class="dialog-target">
        空间：<strong>{{ metadataRow?.namespace }}</strong
        ><span>集群：{{ metadataRow?.cluster }}</span>
      </div>
      <el-skeleton v-if="metadataLoading" animated :rows="6" />
      <template v-else-if="metadataDocument">
        <section class="metadata-editor">
          <div class="metadata-title">
            <h3>标签</h3>
            <el-button :icon="Plus" @click="labels.push({ key: '', value: '' })">添加标签</el-button>
          </div>
          <div v-for="(entry, index) in labels" :key="index" class="metadata-row">
            <el-input v-model="entry.key" :disabled="protectedLabels.has(entry.key)" placeholder="键" /><el-input
              v-model="entry.value"
              placeholder="值"
            /><el-button :icon="Delete" :disabled="protectedLabels.has(entry.key)" @click="labels.splice(index, 1)" />
          </div>
          <p v-if="!labels.length" class="text-secondary">暂无标签</p>
        </section>
        <section class="metadata-editor">
          <div class="metadata-title">
            <h3>注解</h3>
            <el-button :icon="Plus" @click="annotations.push({ key: '', value: '' })">添加注解</el-button>
          </div>
          <div v-for="(entry, index) in annotations" :key="index" class="metadata-row">
            <el-input v-model="entry.key" placeholder="键" /><el-input v-model="entry.value" placeholder="值" /><el-button
              :icon="Delete"
              @click="annotations.splice(index, 1)"
            />
          </div>
          <p v-if="!annotations.length" class="text-secondary">暂无注解</p>
        </section>
      </template>
      <el-alert v-if="submitError" :title="submitError" type="error" show-icon :closable="false" />
      <template #footer
        ><el-button @click="metadataDialogVisible = false">取消</el-button
        ><el-button type="primary" :loading="submitting" :disabled="metadataLoading || !metadataDocument" @click="submitMetadata"
          >保存元信息</el-button
        ></template
      >
    </el-dialog>

    <el-dialog v-model="deleteDialogVisible" title="删除空间" width="min(540px, 94vw)" :close-on-click-modal="false">
      <el-alert :title="`删除空间“${deleteRow?.namespace}”将删除其中的全部资源，且无法撤销。`" type="error" show-icon :closable="false" />
      <p v-if="deleteRow?.isFederateMaster" class="federation-warning">这是联邦主空间，关联业务集群中的联邦空间也会被删除。</p>
      <div class="delete-confirm">
        <label :for="`delete-${deleteRow?.namespace}`"
          >请输入空间名称 <strong>{{ deleteRow?.namespace }}</strong> 以确认：</label
        ><el-input
          :id="`delete-${deleteRow?.namespace}`"
          v-model="deleteConfirmText"
          autocomplete="off"
          placeholder="输入完整空间名称"
          @keyup.enter="deleteConfirmText === deleteRow?.namespace && submitDelete()"
        />
      </div>
      <el-alert v-if="submitError" :title="submitError" type="error" show-icon :closable="false" />
      <template #footer
        ><el-button @click="deleteDialogVisible = false">取消</el-button
        ><el-button type="danger" :loading="deleting" :disabled="deleteConfirmText !== deleteRow?.namespace" @click="submitDelete"
          >确认永久删除</el-button
        ></template
      >
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Delete, Plus, Refresh, Search } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import { clusterApi, namespaceApi } from '@/api/cluster'
import { resourceApi, type ResourceDefinition } from '@/api/resource'
import { scopeApi } from '@/api/scope'
import { useScopeStore } from '@/stores/scope'
import type { ClusterInfo, KubeResource, NamespaceInfo } from '@/types/api'
import { formatDate, formatNumber } from '@/utils/format'

interface SpaceRow {
  key: string
  namespace: string
  cluster: string
  clusterDisplayName: string
  tenant: string
  project: string
  unmanaged: boolean
  isFederateMember: boolean
  isFederateMaster: boolean
  status: string
  creationTimestamp?: string
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
interface SpaceForm extends QuotaForm {
  cluster: string
  namespace: string
  tenant: string
  project: string
}
interface MetaEntry {
  key: string
  value: string
}
const quotaDefinition: ResourceDefinition = { plural: 'resourcequotas', kind: 'ResourceQuota', version: 'v1', namespaced: true }
const namespaceDefinition: ResourceDefinition = { plural: 'namespaces', kind: 'Namespace', version: 'v1', namespaced: false }
const protectedLabels = new Set(['kubecube.io/tenant', 'kubecube.io/project'])
const emptyQuota = (): QuotaForm => ({
  requestsCpu: 0,
  limitsCpu: 0,
  requestsMemory: 0,
  limitsMemory: 0,
  requestsGpu: 0,
  limitsGpu: 0,
  requestsStorage: 0,
})
const emptySpace = (): SpaceForm => ({ cluster: '', namespace: '', tenant: '', project: '', ...emptyQuota() })
const scope = useScopeStore()
const clusters = ref<ClusterInfo[]>([])
const tenants = ref<KubeResource[]>([])
const projects = ref<KubeResource[]>([])
const rows = ref<SpaceRow[]>([])
const loading = ref(false)
const loadError = ref('')
const clusterFilter = ref('')
const tenantFilter = ref('')
const manageFilter = ref('')
const keyword = ref('')
const spaceDialogVisible = ref(false)
const spaceMode = ref<'create' | 'onboard'>('create')
const spaceForm = reactive<SpaceForm>(emptySpace())
const spaceFormRef = ref<FormInstance>()
const quotaDialogVisible = ref(false)
const quotaRow = ref<SpaceRow>()
const existingQuota = ref<KubeResource>()
const quotaLoading = ref(false)
const quotaLoadError = ref('')
const quotaForm = reactive<QuotaForm>(emptyQuota())
const metadataDialogVisible = ref(false)
const metadataRow = ref<SpaceRow>()
const metadataDocument = ref<NamespaceInfo>()
const metadataLoading = ref(false)
const labels = ref<MetaEntry[]>([])
const annotations = ref<MetaEntry[]>([])
const deleteDialogVisible = ref(false)
const deleteRow = ref<SpaceRow>()
const deleteConfirmText = ref('')
const deleting = ref(false)
const submitting = ref(false)
const submitError = ref('')
const controlCluster = computed(() => scope.controlCluster || clusters.value.find((item) => !item.isMemberCluster)?.clusterName || '')
const availableProjects = computed(() =>
  projects.value.filter((project) => {
    const spec = project.spec as Record<string, unknown> | undefined
    const tenant = project.metadata.labels?.['kubecube.io/tenant'] || spec?.tenant || spec?.tenantName
    return !spaceForm.tenant || tenant === spaceForm.tenant
  }),
)
const filteredRows = computed(() =>
  rows.value.filter(
    (row) =>
      (!clusterFilter.value || row.cluster === clusterFilter.value) &&
      (!tenantFilter.value || row.tenant === tenantFilter.value) &&
      (!manageFilter.value || (manageFilter.value === 'unmanaged') === row.unmanaged) &&
      (!keyword.value.trim() ||
        `${row.namespace} ${row.cluster} ${row.tenant} ${row.project}`.toLowerCase().includes(keyword.value.trim().toLowerCase())),
  ),
)
const spaceRules: FormRules<SpaceForm> = {
  cluster: [{ required: true, message: '请选择集群', trigger: 'change' }],
  namespace: [
    { required: true, message: '请输入空间名称', trigger: 'blur' },
    { pattern: /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/, message: '空间名称格式不正确', trigger: 'blur' },
  ],
  tenant: [{ required: true, message: '请选择租户', trigger: 'change' }],
  project: [{ required: true, message: '请选择项目', trigger: 'change' }],
}
function displayName(resource: KubeResource) {
  const spec = resource.spec as Record<string, unknown> | undefined
  return String(spec?.displayName || resource.metadata.name)
}
function tenantName(name: string) {
  return name ? displayName(tenants.value.find((item) => item.metadata.name === name) || { metadata: { name } }) : '—'
}
function projectName(name: string) {
  return name ? displayName(projects.value.find((item) => item.metadata.name === name) || { metadata: { name } }) : '—'
}
function clusterDisplayName(cluster: ClusterInfo) {
  return cluster.clusterDisplayName || cluster.annotations?.['cluster.kubecube.io/cn-name'] || cluster.clusterName
}
function errorText(error: unknown) {
  return error instanceof Error ? error.message : '请求失败，请稍后重试'
}
function isNotFound(error: unknown) {
  return Boolean(
    error &&
    typeof error === 'object' &&
    ((error as { status?: number }).status === 404 || (error as { data?: { reason?: string } }).data?.reason === 'NotFound'),
  )
}
function toEntries(value?: Record<string, string>) {
  return Object.entries(value || {}).map(([key, entryValue]) => ({ key, value: entryValue }))
}
async function loadData() {
  loading.value = true
  loadError.value = ''
  try {
    const clusterResponse = await clusterApi.list({ prune: true })
    clusters.value = clusterResponse.items || []
    if (!controlCluster.value) throw new Error('未找到管控集群，无法读取租户与项目')
    const [tenantResponse, projectResponse, spaceResponse] = await Promise.all([
      scopeApi.list(controlCluster.value, 'tenants'),
      scopeApi.list(controlCluster.value, 'projects'),
      clusterApi.subnamespaces(),
    ])
    tenants.value = tenantResponse.items || []
    projects.value = projectResponse.items || []
    rows.value = (spaceResponse.items || []).map((item) => {
      const source = item as KubeResource & Record<string, unknown>
      const cluster = String(source.cluster || '')
      const namespace = String(source.namespace || item.metadata.name)
      const clusterInfo = clusters.value.find((entry) => entry.clusterName === cluster)
      const status =
        typeof source.status === 'string' ? source.status : String((item.status as Record<string, unknown> | undefined)?.phase || 'Active')
      return {
        key: `${cluster}/${namespace}`,
        namespace,
        cluster,
        clusterDisplayName: clusterInfo ? clusterDisplayName(clusterInfo) : cluster,
        tenant: String(source.tenant || item.metadata.labels?.['kubecube.io/tenant'] || ''),
        project: String(source.project || item.metadata.labels?.['kubecube.io/project'] || ''),
        unmanaged: Boolean(source.unmanaged),
        isFederateMember: Boolean(source.isFederateMember),
        isFederateMaster: Boolean(source.isFederateMaster),
        status,
        creationTimestamp: item.metadata.creationTimestamp,
      }
    })
    await Promise.all(
      rows.value
        .filter((row) => !row.unmanaged)
        .map(async (row) => {
          try {
            const response = await resourceApi.list(
              quotaDefinition,
              { cluster: row.cluster, namespace: row.namespace },
              { pageNum: 1, pageSize: 20 },
            )
            row.quota = response.items?.[0]
          } catch {
            row.quota = undefined
          }
        }),
    )
    rows.value = [...rows.value]
  } catch (error) {
    loadError.value = `空间数据加载失败：${errorText(error)}`
  } finally {
    loading.value = false
  }
}
function clearFilters() {
  clusterFilter.value = ''
  tenantFilter.value = ''
  manageFilter.value = ''
  keyword.value = ''
}
function openCreate() {
  Object.assign(spaceForm, emptySpace())
  spaceMode.value = 'create'
  submitError.value = ''
  spaceDialogVisible.value = true
}
function openOnboard(row: SpaceRow) {
  Object.assign(spaceForm, emptySpace(), { cluster: row.cluster, namespace: row.namespace })
  spaceMode.value = 'onboard'
  submitError.value = ''
  spaceDialogVisible.value = true
}
function quotaHard(form: QuotaForm, removeZero: boolean) {
  const value = (input: number) => (Number.isFinite(Number(input)) ? Number(input) : 0)
  const numeric: Record<string, number> = {
    'requests.cpu': value(form.requestsCpu),
    'limits.cpu': value(form.limitsCpu),
    'requests.memory': value(form.requestsMemory),
    'limits.memory': value(form.limitsMemory),
    'requests.nvidia.com/gpu': value(form.requestsGpu),
    'limits.nvidia.com/gpu': value(form.limitsGpu),
    'requests.storage': value(form.requestsStorage),
  }
  const values: Record<string, string | number> = {
    'requests.cpu': numeric['requests.cpu'] || 0,
    'limits.cpu': numeric['limits.cpu'] || 0,
    'requests.memory': `${numeric['requests.memory'] || 0}Gi`,
    'limits.memory': `${numeric['limits.memory'] || 0}Gi`,
    'requests.nvidia.com/gpu': numeric['requests.nvidia.com/gpu'] || 0,
    'limits.nvidia.com/gpu': numeric['limits.nvidia.com/gpu'] || 0,
    'requests.storage': `${numeric['requests.storage'] || 0}Gi`,
  }
  return Object.fromEntries(
    Object.entries(values)
      .filter(([key]) => removeZero || (numeric[key] || 0) > 0)
      .map(([key, entryValue]) => [key, removeZero && !(numeric[key] || 0) ? null : String(entryValue)]),
  )
}
function quotaResource(cluster: string, namespace: string, tenant: string, project: string, form: QuotaForm) {
  return {
    apiVersion: 'v1',
    kind: 'ResourceQuota',
    metadata: {
      name: `${cluster}.${tenant}.${project}.${namespace}`,
      namespace,
      labels: {
        'kubecube.io/quota': `${cluster}.${tenant}`,
        'kubecube.io/cluster': cluster,
        'kubecube.io/tenant': tenant,
        'kubecube.io/project': project,
      },
    },
    spec: { hard: quotaHard(form, false) },
  }
}
async function submitSpace() {
  if (!(await spaceFormRef.value?.validate().catch(() => false))) return
  const project = projects.value.find((item) => item.metadata.name === spaceForm.project)
  const projectSpec = project?.spec as Record<string, unknown> | undefined
  const scopeNamespace = String(projectSpec?.namespace || spaceForm.project)
  submitting.value = true
  submitError.value = ''
  const payload = {
    cluster: spaceForm.cluster,
    space: {
      metadata: {
        name: spaceForm.namespace,
        namespace: scopeNamespace,
        labels: { 'kubecube.io/tenant': spaceForm.tenant, 'kubecube.io/project': spaceForm.project },
      },
    },
    resourceQuota: quotaResource(spaceForm.cluster, spaceForm.namespace, spaceForm.tenant, spaceForm.project, spaceForm),
  }
  try {
    if (spaceMode.value === 'create') await namespaceApi.createQuota(payload)
    else await clusterApi.onboardNamespace(payload)
    ElMessage.success(spaceMode.value === 'create' ? '空间已创建' : '空间已纳管')
    spaceDialogVisible.value = false
    await loadData()
  } catch (error) {
    submitError.value = errorText(error)
  } finally {
    submitting.value = false
  }
}
function numberValue(value: unknown, kind: 'cpu' | 'memory' | 'gpu') {
  const match = String(value ?? '')
    .trim()
    .match(/^(\d+\.?\d*|\.\d+)([a-zA-Z]*)$/)
  if (!match) return 0
  const number = Number(match[1])
  const unit = match[2] || ''
  if (kind !== 'memory') return unit === 'm' ? number / 1000 : number
  const factors: Record<string, number> = { '': 1 / 1024 ** 3, Ki: 1 / 1024 ** 2, Mi: 1 / 1024, Gi: 1, Ti: 1024 }
  return number * (factors[unit] ?? 1)
}
function quotaSummary(row: SpaceRow) {
  const quota = row.quota
  if (!quota) return []
  const hard = (quota.spec as Record<string, any> | undefined)?.hard || {}
  const used = (quota.status as Record<string, any> | undefined)?.used || {}
  const metrics = [
    { key: 'cpu', label: 'CPU', hardKey: 'requests.cpu', unit: 'Cores', kind: 'cpu' as const },
    { key: 'memory', label: '内存', hardKey: 'requests.memory', unit: 'GiB', kind: 'memory' as const },
    { key: 'gpu', label: 'GPU', hardKey: 'requests.nvidia.com/gpu', unit: '卡', kind: 'gpu' as const },
    { key: 'storage', label: '存储', hardKey: 'requests.storage', unit: 'GiB', kind: 'memory' as const },
  ]
  return metrics
    .map((metric) => {
      const hardValue = numberValue(hard[metric.hardKey], metric.kind)
      if (!hardValue) return null
      const usedValue = numberValue(used[metric.hardKey], metric.kind)
      return {
        key: metric.key,
        label: metric.label,
        value: `${formatNumber(usedValue, 1)} / ${formatNumber(hardValue, 1)} ${metric.unit}`,
      }
    })
    .filter((entry): entry is { key: string; label: string; value: string } => Boolean(entry))
}
function openQuota(row: SpaceRow) {
  quotaRow.value = row
  existingQuota.value = undefined
  Object.assign(quotaForm, emptyQuota())
  quotaLoadError.value = ''
  submitError.value = ''
  quotaDialogVisible.value = true
  void loadQuota()
}
async function loadQuota() {
  const row = quotaRow.value
  if (!row) return
  quotaLoading.value = true
  quotaLoadError.value = ''
  try {
    const response = await resourceApi.list(
      quotaDefinition,
      { cluster: row.cluster, namespace: row.namespace },
      { pageNum: 1, pageSize: 100 },
    )
    existingQuota.value = (response.items || []).find(
      (item) => item.metadata.name === `${row.cluster}.${row.tenant}.${row.project}.${row.namespace}`,
    )
    const spec = existingQuota.value?.spec as Record<string, unknown> | undefined
    const hard = (spec?.hard || {}) as Record<string, unknown>
    Object.assign(quotaForm, {
      requestsCpu: numberValue(hard['requests.cpu'], 'cpu'),
      limitsCpu: numberValue(hard['limits.cpu'], 'cpu'),
      requestsMemory: numberValue(hard['requests.memory'], 'memory'),
      limitsMemory: numberValue(hard['limits.memory'], 'memory'),
      requestsGpu: numberValue(hard['requests.nvidia.com/gpu'], 'gpu'),
      limitsGpu: numberValue(hard['limits.nvidia.com/gpu'], 'gpu'),
      requestsStorage: numberValue(hard['requests.storage'], 'memory'),
    })
  } catch (error) {
    quotaLoadError.value = `空间配额读取失败：${errorText(error)}`
  } finally {
    quotaLoading.value = false
  }
}
async function submitQuota() {
  const row = quotaRow.value
  if (!row) return
  submitting.value = true
  submitError.value = ''
  try {
    if (existingQuota.value)
      await resourceApi.patch(
        quotaDefinition,
        { cluster: row.cluster, namespace: row.namespace, name: existingQuota.value.metadata.name },
        { spec: { hard: quotaHard(quotaForm, true) } },
        'merge',
      )
    else
      await resourceApi.create(
        quotaDefinition,
        { cluster: row.cluster, namespace: row.namespace },
        quotaResource(row.cluster, row.namespace, row.tenant, row.project, quotaForm),
      )
    ElMessage.success('空间配额已保存')
    quotaDialogVisible.value = false
    await loadData()
  } catch (error) {
    submitError.value = errorText(error)
  } finally {
    submitting.value = false
  }
}
async function openMetadata(row: SpaceRow) {
  metadataRow.value = row
  metadataDocument.value = undefined
  metadataDialogVisible.value = true
  metadataLoading.value = true
  submitError.value = ''
  try {
    const response = await namespaceApi.get(row.cluster, row.namespace)
    metadataDocument.value = response
    labels.value = toEntries(response.metadata.labels)
    annotations.value = toEntries(response.metadata.annotations)
  } catch (error) {
    submitError.value = `空间元信息读取失败：${errorText(error)}`
  } finally {
    metadataLoading.value = false
  }
}
function validateEntries(entries: MetaEntry[], label: string) {
  if (entries.some((entry) => !entry.key.trim())) return `${label}的键不能为空`
  if (new Set(entries.map((entry) => entry.key.trim())).size !== entries.length) return `${label}的键不能重复`
  return ''
}
async function submitMetadata() {
  const row = metadataRow.value
  const document = metadataDocument.value
  if (!row || !document) return
  const validationError = validateEntries(labels.value, '标签') || validateEntries(annotations.value, '注解')
  if (validationError) {
    submitError.value = validationError
    return
  }
  submitting.value = true
  submitError.value = ''
  try {
    const data = structuredClone(document)
    data.metadata.labels = Object.fromEntries(labels.value.map((entry) => [entry.key.trim(), entry.value]))
    data.metadata.annotations = Object.fromEntries(annotations.value.map((entry) => [entry.key.trim(), entry.value]))
    await namespaceApi.update(row.cluster, row.namespace, data)
    ElMessage.success('空间元信息已更新')
    metadataDialogVisible.value = false
    await loadData()
  } catch (error) {
    submitError.value = errorText(error)
  } finally {
    submitting.value = false
  }
}
function openDelete(row: SpaceRow) {
  deleteRow.value = row
  deleteConfirmText.value = ''
  submitError.value = ''
  deleteDialogVisible.value = true
}
async function submitDelete() {
  const row = deleteRow.value
  if (!row || deleteConfirmText.value !== row.namespace) return
  deleting.value = true
  submitError.value = ''
  try {
    try {
      await resourceApi.delete(quotaDefinition, {
        cluster: row.cluster,
        namespace: row.namespace,
        name: `${row.cluster}.${row.tenant}.${row.project}.${row.namespace}`,
      })
    } catch (error) {
      if (!isNotFound(error)) throw error
    }
    await resourceApi.delete(namespaceDefinition, { cluster: row.cluster, name: row.namespace })
    ElMessage.success('空间删除请求已完成')
    deleteDialogVisible.value = false
    await loadData()
  } catch (error) {
    submitError.value = errorText(error)
  } finally {
    deleting.value = false
  }
}
onMounted(loadData)
</script>

<style scoped>
.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 16px 20px;
}
.filter-control {
  width: 200px;
}
.filter-control.small {
  width: 150px;
}
.keyword-input {
  width: 260px;
  margin-left: auto;
}
.list-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}
.list-heading h2 {
  font-size: 17px;
}
.list-heading h2 span {
  margin-left: 6px;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 400;
}
.list-heading p {
  color: var(--text-secondary);
  font-size: 12px;
}
.quota-cell {
  display: grid;
  gap: 3px;
  font-size: 12px;
}
.quota-cell strong {
  color: var(--text-secondary);
  font-weight: 500;
}
.cell-subtitle {
  margin-top: 3px;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 400;
}
.dialog-notice {
  margin-bottom: 20px;
}
.dialog-target {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  padding: 12px 14px;
  background: var(--surface-subtle);
  border-radius: 8px;
}
.dialog-target span {
  margin-left: auto;
  color: var(--text-secondary);
}
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 14px;
}
.form-grid .el-select {
  width: 100%;
}
.form-help {
  margin: -4px 0 18px;
  color: var(--text-secondary);
  font-size: 12px;
}
.quota-form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px 14px;
  margin-bottom: 20px;
  padding-left: 105px;
}
.quota-form-grid .el-input-number {
  width: 100%;
}
.quota-edit-grid {
  padding-left: 0;
}
.quota-edit-grid label {
  color: var(--text-regular);
  font-size: 13px;
}
.quota-edit-grid .el-input-number {
  display: flex;
  margin-top: 7px;
}
.metadata-editor {
  margin-bottom: 22px;
}
.metadata-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.metadata-title h3 {
  font-size: 14px;
}
.metadata-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 40px;
  gap: 10px;
  margin-bottom: 10px;
}
.federation-warning {
  margin: 16px 0;
  color: var(--warning);
}
.delete-confirm {
  margin: 20px 0;
}
.delete-confirm label {
  display: block;
  margin-bottom: 10px;
  line-height: 1.7;
}
@media (max-width: 900px) {
  .quota-form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    padding-left: 0;
  }
  .list-heading {
    align-items: flex-start;
    flex-direction: column;
  }
}
@media (max-width: 700px) {
  .filter-bar {
    align-items: stretch;
    flex-direction: column;
  }
  .filter-control,
  .filter-control.small,
  .keyword-input {
    width: 100%;
    margin-left: 0;
  }
  .form-grid,
  .quota-form-grid {
    grid-template-columns: 1fr;
  }
  .metadata-row {
    grid-template-columns: 1fr;
  }
  .metadata-row .el-button {
    justify-self: end;
  }
}
</style>
