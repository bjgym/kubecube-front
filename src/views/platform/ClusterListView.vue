<template>
  <div class="page page-stack">
    <PageHeader title="集群管理" description="统一查看集群健康状态与资源容量，维护集群基础信息。">
      <template #actions>
        <el-button :icon="Refresh" :loading="loading" @click="loadClusters">刷新</el-button>
        <el-button type="primary" :icon="Plus" @click="openAdd">添加集群</el-button>
      </template>
    </PageHeader>

    <div class="metrics-grid">
      <MetricCard label="集群总数" :value="clusters.length" caption="管控集群与业务集群" :loading="loading && !clusters.length" />
      <MetricCard label="正常集群" :value="normalCount" caption="状态为正常的集群" tone="success" :loading="loading && !clusters.length" />
      <MetricCard label="节点总数" :value="totalNodes" caption="全部集群节点" tone="info" :loading="loading && !clusters.length" />
      <MetricCard label="空间总数" :value="totalNamespaces" caption="全部集群空间" tone="warning" :loading="loading && !clusters.length" />
    </div>

    <el-alert v-if="loadError" class="load-alert" type="error" :title="loadError" show-icon :closable="false">
      <template #default><el-button link type="primary" @click="loadClusters">重新加载</el-button></template>
    </el-alert>

    <section class="surface surface-padded">
      <div class="toolbar list-toolbar">
        <div>
          <h2>集群列表</h2>
          <p class="text-secondary">点击集群名称进入详情，资源数据来自集群信息接口。</p>
        </div>
        <el-input v-model="keyword" class="search-input" clearable :prefix-icon="Search" placeholder="搜索名称、标识或描述" />
      </div>

      <el-table v-loading="loading" :data="filteredClusters" row-key="clusterName" class="cluster-table">
        <el-table-column label="集群名称 / 标识" min-width="220" fixed="left">
          <template #default="{ row }">
            <router-link class="cluster-link" :to="`/platform/cluster/${encodeURIComponent(row.clusterName)}/info`">
              {{ displayName(row) }}
            </router-link>
            <div class="text-secondary cluster-id">{{ row.clusterName }}</div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="105">
          <template #default="{ row }"><StatusTag :status="row.status" :label="statusLabel(row.status)" /></template>
        </el-table-column>
        <el-table-column label="用途" width="105">
          <template #default="{ row }">{{ row.isMemberCluster ? '业务集群' : '管控集群' }}</template>
        </el-table-column>
        <el-table-column label="CPU（已用 / 总计）" min-width="185">
          <template #default="{ row }">
            <div>{{ formatNumber(row.usedCpu) }} / {{ formatNumber(row.totalCpu) }} Cores</div>
            <el-progress :percentage="usagePercent(row.usedCpu, row.totalCpu)" :show-text="false" />
          </template>
        </el-table-column>
        <el-table-column label="内存（已用 / 总计）" min-width="200">
          <template #default="{ row }">
            <div>{{ formatBytes(row.usedMem, 'Mi') }} / {{ formatBytes(row.totalMem, 'Mi') }}</div>
            <el-progress :percentage="usagePercent(row.usedMem, row.totalMem)" :show-text="false" />
          </template>
        </el-table-column>
        <el-table-column prop="nodeCount" label="节点" width="80" align="center">
          <template #default="{ row }">{{ row.nodeCount ?? '—' }}</template>
        </el-table-column>
        <el-table-column prop="namespaceCount" label="空间" width="80" align="center">
          <template #default="{ row }">{{ row.namespaceCount ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="255" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="primary" :disabled="!canRemove(row)" @click="openRemoveGuide(row)">删除配置</el-button>
            <el-button link type="primary" @click="openDomain(row)">域名后缀</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <EmptyState
            v-if="!loading && !loadError"
            :title="keyword ? '没有匹配的集群' : '暂无集群'"
            :description="keyword ? '请调整搜索关键词后重试。' : '可点击“添加集群”纳管第一个业务集群。'"
            :action-text="keyword ? '清空搜索' : '添加集群'"
            @action="keyword ? (keyword = '') : openAdd()"
          />
        </template>
      </el-table>
      <div v-if="keyword && filteredClusters.length" class="table-footer text-secondary">共 {{ filteredClusters.length }} 个匹配集群</div>
    </section>

    <el-dialog
      v-model="clusterDialogVisible"
      :title="editingName ? '编辑集群' : '添加集群'"
      width="min(680px, 94vw)"
      :close-on-click-modal="false"
      @closed="resetClusterForm"
    >
      <el-form ref="clusterFormRef" :model="clusterForm" :rules="clusterRules" label-width="110px">
        <el-alert
          v-if="!editingName"
          title="添加前请确认目标集群网络可达，并准备具有集群管理权限的 KubeConfig。"
          type="info"
          :closable="false"
          class="dialog-alert"
        />
        <el-form-item label="集群名称" prop="clusterDisplayName"
          ><el-input v-model="clusterForm.clusterDisplayName" maxlength="100" placeholder="用于页面展示的名称"
        /></el-form-item>
        <el-form-item label="集群标识" prop="clusterName"
          ><el-input v-model="clusterForm.clusterName" :disabled="Boolean(editingName)" placeholder="小写字母、数字或中划线"
        /></el-form-item>
        <el-form-item label="描述" prop="description"
          ><el-input v-model="clusterForm.description" maxlength="128" show-word-limit placeholder="选填，最多 128 个字符"
        /></el-form-item>
        <el-form-item label="网络类型" prop="networkType">
          <el-select v-model="clusterForm.networkType" filterable allow-create default-first-option placeholder="选择或输入网络类型">
            <el-option v-for="item in networkTypes" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <template v-if="!editingName">
          <el-form-item label="KubeConfig" prop="kubeConfig"
            ><el-input
              v-model="clusterForm.kubeConfig"
              type="textarea"
              :rows="8"
              class="mono"
              placeholder="粘贴 KubeConfig 内容，或从下方选择文件"
          /></el-form-item>
          <el-form-item label=" "
            ><el-upload :auto-upload="false" :show-file-list="false" accept=".yaml,.yml,.conf,.config" :on-change="readKubeConfig"
              ><el-button :icon="Upload">选择配置文件</el-button></el-upload
            ><span class="upload-tip">文件不超过 1 MiB，仅在浏览器中读取并提交</span></el-form-item
          >
        </template>
      </el-form>
      <el-alert v-if="submitError" :title="submitError" type="error" show-icon :closable="false" />
      <template #footer
        ><el-button @click="clusterDialogVisible = false">取消</el-button
        ><el-button type="primary" :loading="submitting" @click="submitCluster">{{
          editingName ? '保存修改' : '确认添加'
        }}</el-button></template
      >
    </el-dialog>

    <el-dialog v-model="domainDialogVisible" title="定制域名后缀" width="min(520px, 94vw)" :close-on-click-modal="false">
      <p class="dialog-description">该后缀用于集群 Ingress 转发规则。清空后保存可移除自定义后缀。</p>
      <el-form ref="domainFormRef" :model="domainForm" :rules="domainRules" label-width="110px" @submit.prevent>
        <el-form-item label="集群"><el-input :model-value="domainCluster?.clusterName" disabled /></el-form-item>
        <el-form-item label="Ingress 后缀" prop="suffix"
          ><el-input v-model="domainForm.suffix" placeholder="例如：apps.example.com" clearable
        /></el-form-item>
      </el-form>
      <el-alert v-if="submitError" :title="submitError" type="error" show-icon :closable="false" />
      <template #footer
        ><el-button @click="domainDialogVisible = false">取消</el-button
        ><el-button type="primary" :loading="submitting" @click="submitDomain">保存</el-button></template
      >
    </el-dialog>

    <el-dialog v-model="removeDialogVisible" title="删除集群配置指引" width="min(620px, 94vw)">
      <el-alert title="此操作需要在集群中执行卸载步骤，页面不会伪造删除结果。" type="warning" show-icon :closable="false" />
      <div class="remove-guide">
        <p>
          集群：<strong>{{ removingCluster?.clusterName }}</strong>
        </p>
        <ol>
          <li>先迁移或删除该集群中的业务工作负载，并确认数据已备份。</li>
          <li>按照 KubeCube 文档卸载计算集群中的 Warden。</li>
          <li>卸载完成后返回本页刷新，确认平台中的集群配置已移除。</li>
        </ol>
        <el-link
          type="primary"
          href="https://www.kubecube.io/docs/installation-guide/install-on-k8s/install-member-by-helm/#卸载计算集群中的-warden"
          target="_blank"
          rel="noopener noreferrer"
          >查看卸载与删除配置文档</el-link
        >
      </div>
      <template #footer><el-button type="primary" @click="removeDialogVisible = false">我知道了</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, type FormInstance, type FormRules, type UploadFile } from 'element-plus'
import { Plus, Refresh, Search, Upload } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import MetricCard from '@/components/MetricCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import { clusterApi } from '@/api/cluster'
import { resourceApi, type ResourceDefinition } from '@/api/resource'
import { useScopeStore } from '@/stores/scope'
import type { ClusterInfo } from '@/types/api'
import { formatBytes, formatNumber } from '@/utils/format'

interface ClusterForm {
  clusterDisplayName: string
  clusterName: string
  description: string
  networkType: string
  kubeConfig: string
}
const emptyForm = (): ClusterForm => ({ clusterDisplayName: '', clusterName: '', description: '', networkType: 'cilium', kubeConfig: '' })
const clusterDefinition: ResourceDefinition = {
  plural: 'clusters',
  kind: 'Cluster',
  group: 'cluster.kubecube.io',
  version: 'v1',
  namespaced: false,
}
const networkTypes = ['cilium', 'calico', 'flannel', 'kube-ovn']
const scope = useScopeStore()
const clusters = ref<ClusterInfo[]>([])
const loading = ref(false)
const loadError = ref('')
const keyword = ref('')
const clusterDialogVisible = ref(false)
const domainDialogVisible = ref(false)
const removeDialogVisible = ref(false)
const submitting = ref(false)
const submitError = ref('')
const editingName = ref('')
const clusterForm = reactive<ClusterForm>(emptyForm())
const clusterFormRef = ref<FormInstance>()
const domainFormRef = ref<FormInstance>()
const domainCluster = ref<ClusterInfo>()
const removingCluster = ref<ClusterInfo>()
const domainForm = reactive({ suffix: '' })

const controlCluster = computed(() => scope.controlCluster || clusters.value.find((item) => !item.isMemberCluster)?.clusterName || '')
const filteredClusters = computed(() => {
  const value = keyword.value.trim().toLowerCase()
  if (!value) return clusters.value
  return clusters.value.filter((item) =>
    [displayName(item), item.clusterName, item.clusterDescription].some((text) =>
      String(text || '')
        .toLowerCase()
        .includes(value),
    ),
  )
})
const normalCount = computed(() => clusters.value.filter((item) => item.status === 'normal' || !item.status).length)
const totalNodes = computed(() => clusters.value.reduce((sum, item) => sum + (Number(item.nodeCount) || 0), 0))
const totalNamespaces = computed(() => clusters.value.reduce((sum, item) => sum + (Number(item.namespaceCount) || 0), 0))
const clusterRules = computed<FormRules<ClusterForm>>(() => ({
  clusterDisplayName: [{ required: true, message: '请输入集群名称', trigger: 'blur' }],
  clusterName: [
    { required: true, message: '请输入集群标识', trigger: 'blur' },
    { pattern: /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/, message: '仅支持小写字母、数字和中划线，且须以字母或数字开头和结尾', trigger: 'blur' },
  ],
  networkType: [{ required: true, message: '请选择网络类型', trigger: 'change' }],
  kubeConfig: editingName.value ? [] : [{ required: true, message: '请粘贴或选择 KubeConfig', trigger: 'blur' }],
}))
const domainRules: FormRules = {
  suffix: [
    {
      pattern: /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/,
      message: '请输入合法的域名后缀，例如 apps.example.com',
      trigger: 'blur',
    },
  ],
}

function displayName(item: ClusterInfo) {
  return item.clusterDisplayName || item.annotations?.['cluster.kubecube.io/cn-name'] || item.clusterName
}
function statusLabel(status?: string) {
  return (
    ({ normal: '正常', abnormal: '异常', processing: '接入中', deleting: '删除中' } as Record<string, string>)[status || ''] ||
    status ||
    '未知'
  )
}
function usagePercent(used?: number, total?: number) {
  return total && total > 0 ? Math.min(100, Math.max(0, Math.round((Number(used || 0) / total) * 100))) : 0
}
function canRemove(item: ClusterInfo) {
  return item.clusterName !== controlCluster.value && !['deleting', 'processing'].includes(item.status || '')
}
function errorText(error: unknown) {
  return error instanceof Error ? error.message : '请求失败，请稍后重试'
}

async function loadClusters() {
  loading.value = true
  loadError.value = ''
  try {
    clusters.value = (await clusterApi.list()).items || []
  } catch (error) {
    loadError.value = `集群数据加载失败：${errorText(error)}`
  } finally {
    loading.value = false
  }
}
function openAdd() {
  editingName.value = ''
  Object.assign(clusterForm, emptyForm())
  submitError.value = ''
  clusterDialogVisible.value = true
}
function openEdit(item: ClusterInfo) {
  if (!controlCluster.value) {
    ElMessage.warning('未找到管控集群，无法编辑集群配置')
    return
  }
  editingName.value = item.clusterName
  Object.assign(clusterForm, {
    clusterDisplayName: displayName(item),
    clusterName: item.clusterName,
    description: item.clusterDescription || '',
    networkType: String(item.networkType || 'cilium'),
    kubeConfig: '',
  })
  submitError.value = ''
  clusterDialogVisible.value = true
}
function resetClusterForm() {
  clusterFormRef.value?.resetFields()
  Object.assign(clusterForm, emptyForm())
  editingName.value = ''
  submitError.value = ''
}
function encodeBase64(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}
async function readKubeConfig(file: UploadFile) {
  if (!file.raw) return
  if (file.raw.size > 1024 * 1024) {
    ElMessage.warning('KubeConfig 文件不能超过 1 MiB')
    return
  }
  try {
    clusterForm.kubeConfig = await file.raw.text()
    clusterFormRef.value?.validateField('kubeConfig').catch(() => undefined)
  } catch {
    ElMessage.error('配置文件读取失败，请重试')
  }
}
async function submitCluster() {
  if (!(await clusterFormRef.value?.validate().catch(() => false))) return
  submitting.value = true
  submitError.value = ''
  try {
    if (editingName.value) {
      await resourceApi.patch(
        clusterDefinition,
        { cluster: controlCluster.value, name: editingName.value },
        {
          metadata: { annotations: { 'cluster.kubecube.io/cn-name': clusterForm.clusterDisplayName } },
          spec: { description: clusterForm.description, networkType: clusterForm.networkType },
        },
        'merge',
      )
      ElMessage.success('集群信息已更新')
    } else {
      await clusterApi.add({ ...clusterForm, kubeConfig: encodeBase64(clusterForm.kubeConfig) })
      ElMessage.success('集群添加请求已提交')
    }
    clusterDialogVisible.value = false
    await loadClusters()
  } catch (error) {
    submitError.value = errorText(error)
  } finally {
    submitting.value = false
  }
}
function openDomain(item: ClusterInfo) {
  if (!controlCluster.value) {
    ElMessage.warning('未找到管控集群，无法设置域名后缀')
    return
  }
  domainCluster.value = item
  domainForm.suffix = String(item.ingressDomainSuffix || '')
  submitError.value = ''
  domainDialogVisible.value = true
}
async function submitDomain() {
  if (!domainCluster.value || !(await domainFormRef.value?.validate().catch(() => false))) return
  submitting.value = true
  submitError.value = ''
  try {
    await resourceApi.patch(
      clusterDefinition,
      { cluster: controlCluster.value, name: domainCluster.value.clusterName },
      { spec: { ingressDomainSuffix: domainForm.suffix.trim() } },
      'merge',
    )
    ElMessage.success('域名后缀已保存')
    domainDialogVisible.value = false
    await loadClusters()
  } catch (error) {
    submitError.value = errorText(error)
  } finally {
    submitting.value = false
  }
}
function openRemoveGuide(item: ClusterInfo) {
  removingCluster.value = item
  removeDialogVisible.value = true
}
onMounted(loadClusters)
</script>

<style scoped>
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}
.list-toolbar {
  margin-bottom: 20px;
}
.list-toolbar h2 {
  font-size: 17px;
}
.list-toolbar p {
  margin-top: 4px;
  font-size: 13px;
}
.search-input {
  width: min(320px, 100%);
}
.cluster-table {
  width: 100%;
}
.cluster-link {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  font-weight: 550;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cluster-id {
  margin-top: 2px;
  font-size: 12px;
}
.el-progress {
  max-width: 160px;
  margin-top: 6px;
}
.table-footer {
  margin-top: 14px;
  text-align: right;
  font-size: 13px;
}
.dialog-alert {
  margin-bottom: 20px;
}
.dialog-description {
  margin-bottom: 20px;
  color: var(--text-secondary);
}
.upload-tip {
  margin-left: 12px;
  color: var(--text-secondary);
  font-size: 12px;
}
.remove-guide {
  margin-top: 20px;
  line-height: 1.8;
}
.remove-guide ol {
  padding-left: 22px;
  color: var(--text-regular);
}
.load-alert {
  align-items: center;
}
@media (max-width: 1100px) {
  .metrics-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 640px) {
  .metrics-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .list-toolbar {
    align-items: stretch;
  }
  .search-input {
    width: 100%;
  }
  .upload-tip {
    display: block;
    margin: 8px 0 0;
  }
}
</style>
