<template>
  <div class="page page-stack crd-detail-page">
    <PageHeader
      :title="name || '自定义资源详情'"
      :description="crd ? `${kind} · ${apiVersion}` : '查看自定义资源定义及其资源实例'"
      :breadcrumbs="['资源控制台', '自定义资源', name]"
    >
      <template #actions>
        <el-button :icon="ArrowLeft" @click="goBack">返回列表</el-button>
        <el-button :icon="Refresh" :loading="crdLoading" @click="refreshAll">刷新</el-button>
        <el-button :icon="Document" :disabled="!crd || deletingCrd" @click="openCrdYaml">查看 CRD YAML</el-button>
        <el-button type="primary" plain :icon="EditPen" :disabled="!crd || deletingCrd" @click="openCrdYamlEditor">YAML 设置</el-button>
        <el-button type="danger" plain :icon="Delete" :disabled="!crd" :loading="deletingCrd" @click="deleteCrd">删除 CRD</el-button>
      </template>
    </PageHeader>

    <el-alert v-if="crdError" type="error" :title="crdError" show-icon :closable="false">
      <template #default><el-button link type="primary" @click="loadCrd">重新加载</el-button></template>
    </el-alert>
    <section v-if="crdLoading && !crd" class="surface surface-padded"><el-skeleton :rows="5" animated /></section>

    <template v-if="crd">
      <section class="surface crd-overview">
        <div class="overview-heading">
          <div class="crd-identity">
            <span class="crd-identity__icon"
              ><el-icon><Files /></el-icon
            ></span>
            <div>
              <h2>定义信息</h2>
              <p>CustomResourceDefinition · {{ crd.metadata.name }}</p>
            </div>
          </div>
          <el-tag effect="plain" :type="isNamespaced ? 'success' : 'warning'">{{ isNamespaced ? 'Namespaced' : 'Cluster' }}</el-tag>
        </div>
        <div class="overview-grid">
          <div>
            <span>API 组</span><code>{{ crd.spec?.group || '—' }}</code>
          </div>
          <div>
            <span>资源 Kind</span><strong>{{ kind }}</strong>
          </div>
          <div>
            <span>复数名称</span><code>{{ crd.spec?.names?.plural || '—' }}</code>
          </div>
          <div>
            <span>当前版本</span><el-tag size="small" effect="plain">{{ version }}</el-tag>
          </div>
          <div>
            <span>作用域</span><strong>{{ crd.spec?.scope || '—' }}</strong>
          </div>
          <div>
            <span>创建时间</span><strong>{{ formatDate(crd.metadata.creationTimestamp) }}</strong>
          </div>
        </div>
        <div class="available-versions">
          <span>可用版本</span>
          <div>
            <el-tag
              v-for="item in availableVersions"
              :key="item.name"
              size="small"
              :effect="item.name === version ? 'dark' : 'plain'"
              :type="item.name === version ? 'primary' : 'info'"
              >{{ item.name }}<template v-if="item.storage"> · 存储版本</template></el-tag
            >
          </div>
        </div>
      </section>

      <section class="surface instances-surface">
        <div class="instances-toolbar">
          <div class="instances-title">
            <h2>资源实例</h2>
            <el-tag size="small" effect="plain" type="info">{{ total }}</el-tag
            ><span v-if="isNamespaced" class="namespace-hint"
              ><el-icon><Collection /></el-icon>{{ scope.namespace || '未选择空间' }}</span
            >
          </div>
          <el-button type="primary" :icon="Plus" :disabled="!canUseInstanceApi" @click="openCreateInstance">创建 {{ kind }}</el-button>
        </div>

        <el-alert
          v-if="isNamespaced && !scope.namespace"
          class="instance-alert"
          type="warning"
          title="请先选择一个命名空间"
          description="命名空间级自定义资源需要在具体空间中查询和创建，请在顶部工作空间中完成选择。"
          show-icon
          :closable="false"
        />
        <el-alert
          v-else-if="!instanceDefinition"
          class="instance-alert"
          type="error"
          title="CRD 定义不完整，无法构造资源实例 API"
          description="请检查 spec.group、spec.names.kind、spec.names.plural 以及路由中的版本。"
          show-icon
          :closable="false"
        />
        <el-alert v-if="instanceError" class="instance-alert" type="error" :title="instanceError" show-icon :closable="false">
          <template #default><el-button link type="primary" @click="loadInstances">重试</el-button></template>
        </el-alert>

        <el-table v-loading="instanceLoading" :data="instances" row-key="metadata.name">
          <el-table-column label="名称" min-width="240" show-overflow-tooltip>
            <template #default="{ row }"
              ><div class="instance-name">
                <span
                  ><el-icon><Box /></el-icon
                ></span>
                <div>
                  <strong>{{ row.metadata.name }}</strong
                  ><small>{{ kind }}</small>
                </div>
              </div></template
            >
          </el-table-column>
          <el-table-column v-if="isNamespaced" prop="metadata.namespace" label="命名空间" min-width="160" show-overflow-tooltip />
          <el-table-column label="API 版本" min-width="190" show-overflow-tooltip>
            <template #default="{ row }"
              ><code class="api-version">{{ row.apiVersion || apiVersion }}</code></template
            >
          </el-table-column>
          <el-table-column label="创建时间" width="176">
            <template #default="{ row }">{{ formatDate(row.metadata.creationTimestamp) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="210" fixed="right" align="right">
            <template #default="{ row }"
              ><div class="row-actions">
                <el-button link type="primary" :icon="View" @click="openInstanceYaml(row, true)">YAML</el-button>
                <el-button link type="primary" :icon="EditPen" @click="openInstanceYaml(row, false)">编辑</el-button>
                <el-button link type="danger" :icon="Delete" :loading="deletingName === row.metadata.name" @click="deleteInstance(row)"
                  >删除</el-button
                >
              </div></template
            >
          </el-table-column>
          <template #empty>
            <EmptyState
              :title="canUseInstanceApi ? `暂无 ${kind} 实例` : '等待工作空间信息'"
              :description="
                canUseInstanceApi ? `当前${isNamespaced ? '空间' : '集群'}中还没有该自定义资源实例` : '选择集群与命名空间后即可查询资源实例'
              "
              :action-text="canUseInstanceApi ? `创建 ${kind}` : undefined"
              @action="openCreateInstance"
            />
          </template>
        </el-table>
        <div class="list-footer">
          <span class="total-text">{{ isNamespaced ? `空间 ${scope.namespace || '—'} · ` : '集群范围 · ' }}共 {{ total }} 个实例</span>
          <el-pagination
            background
            :current-page="instancePage"
            :page-size="instancePageSize"
            :page-sizes="[10, 20, 50, 100]"
            :total="total"
            layout="total, sizes, prev, pager, next"
            @current-change="onInstancePage"
            @size-change="onInstancePageSize"
          />
        </div>
      </section>
    </template>

    <YamlEditorDialog
      v-model="yamlOpen"
      :title="yamlTitle"
      :content="yamlContent"
      :read-only="yamlReadOnly"
      :submitting="yamlSubmitting"
      @submit="submitYaml"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Box, Collection, Delete, Document, EditPen, Files, Plus, Refresh, View } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import YamlEditorDialog from '@/components/YamlEditorDialog.vue'
import { resourceApi, type ResourceContext, type ResourceDefinition } from '@/api/resource'
import { useScopeStore } from '@/stores/scope'
import { formatDate } from '@/utils/format'
import { fromYAML, toYAML } from '@/utils/yaml'
import type { KubeResource } from '@/types/api'

interface CrdVersion {
  name: string
  served?: boolean
  storage?: boolean
}
interface CrdSpec {
  group?: string
  scope?: string
  version?: string
  versions?: CrdVersion[]
  names?: { kind?: string; plural?: string; singular?: string; shortNames?: string[] }
  [key: string]: unknown
}
type CrdResource = KubeResource<CrdSpec>
type YamlMode = 'crd' | 'crd-edit' | 'create' | 'edit' | 'view'

const CRD_DEFINITION: ResourceDefinition = {
  plural: 'customresourcedefinitions',
  kind: 'CustomResourceDefinition',
  group: 'apiextensions.k8s.io',
  version: 'v1',
  namespaced: false,
}

const route = useRoute()
const router = useRouter()
const scope = useScopeStore()
const crd = ref<CrdResource>()
const crdLoading = ref(false)
const crdError = ref('')
const instances = ref<KubeResource[]>([])
const total = ref(0)
const instanceLoading = ref(false)
const instanceError = ref('')
const instancePage = ref(1)
const instancePageSize = ref(10)
const deletingName = ref('')
const deletingCrd = ref(false)
const yamlOpen = ref(false)
const yamlTitle = ref('')
const yamlContent = ref('')
const yamlReadOnly = ref(true)
const yamlSubmitting = ref(false)
const yamlMode = ref<YamlMode>('view')
const activeInstance = ref<KubeResource>()
let crdRequestId = 0
let instanceRequestId = 0

const name = computed(() => String(route.params.name || ''))
const version = computed(() => String(route.params.version || ''))
const routeLevel = computed(() => (route.params.level === 'Namespaced' ? 'Namespaced' : 'Cluster'))
const kind = computed(() => crd.value?.spec?.names?.kind || 'CustomResource')
const isNamespaced = computed(() => (crd.value?.spec?.scope ? crd.value.spec.scope === 'Namespaced' : routeLevel.value === 'Namespaced'))
const apiVersion = computed(() => `${crd.value?.spec?.group || ''}/${version.value}`.replace(/^\//, ''))
const availableVersions = computed<CrdVersion[]>(() => {
  if (crd.value?.spec?.versions?.length) return crd.value.spec.versions
  return crd.value?.spec?.version ? [{ name: crd.value.spec.version }] : [{ name: version.value }]
})
const instanceDefinition = computed<ResourceDefinition | null>(() => {
  const spec = crd.value?.spec
  if (!spec?.group || !spec.names?.plural || !spec.names.kind || !version.value) return null
  return {
    group: spec.group,
    version: version.value,
    plural: spec.names.plural,
    kind: spec.names.kind,
    namespaced: spec.scope === 'Namespaced',
  }
})
const canUseInstanceApi = computed(() => Boolean(instanceDefinition.value && scope.cluster && (!isNamespaced.value || scope.namespace)))

function instanceContext(row?: KubeResource, namespaceOverride?: string): ResourceContext {
  return {
    cluster: scope.cluster,
    namespace: isNamespaced.value ? namespaceOverride || row?.metadata.namespace || scope.namespace : undefined,
    name: row?.metadata.name,
  }
}

async function loadCrd() {
  const id = ++crdRequestId
  ++instanceRequestId
  if (!scope.cluster || !name.value) {
    crdLoading.value = false
    instanceLoading.value = false
    instanceError.value = ''
    instances.value = []
    total.value = 0
    crdError.value = '请先选择集群后再查看 CRD 详情'
    return
  }
  crdLoading.value = true
  crdError.value = ''
  instanceError.value = ''
  try {
    const response = await resourceApi.get(CRD_DEFINITION, { cluster: scope.cluster, name: name.value })
    if (id !== crdRequestId) return
    crd.value = response as CrdResource
    await loadInstances()
  } catch (reason) {
    if (id !== crdRequestId) return
    crdError.value = reason instanceof Error ? reason.message : 'CRD 详情加载失败'
  } finally {
    if (id === crdRequestId) crdLoading.value = false
  }
}

async function loadInstances() {
  const definition = instanceDefinition.value
  const id = ++instanceRequestId
  if (!definition || !scope.cluster || (definition.namespaced && !scope.namespace)) {
    instances.value = []
    total.value = 0
    instanceLoading.value = false
    instanceError.value = ''
    return
  }
  instanceLoading.value = true
  instanceError.value = ''
  try {
    const response = await resourceApi.list(definition, instanceContext(), {
      pageNum: instancePage.value,
      pageSize: instancePageSize.value,
      sortName: 'metadata.creationTimestamp',
      sortOrder: 'desc',
      sortFunc: 'time',
    })
    if (id !== instanceRequestId) return
    instances.value = response.items || []
    total.value = response.total ?? instances.value.length
    if (!instances.value.length && total.value > 0 && instancePage.value > 1) {
      instancePage.value--
      await loadInstances()
    }
  } catch (reason) {
    if (id !== instanceRequestId) return
    instanceError.value = reason instanceof Error ? reason.message : '资源实例加载失败'
  } finally {
    if (id === instanceRequestId) instanceLoading.value = false
  }
}

function refreshAll() {
  void loadCrd()
}
function goBack() {
  void router.push({ name: 'crd.list', params: { level: crd.value?.spec?.scope || routeLevel.value }, query: route.query })
}
function onInstancePage(page: number) {
  instancePage.value = page
  void loadInstances()
}
function onInstancePageSize(size: number) {
  instancePageSize.value = size
  instancePage.value = 1
  void loadInstances()
}

function openCrdYaml() {
  if (!crd.value) return
  yamlMode.value = 'crd'
  yamlTitle.value = `${crd.value.metadata.name} · CRD YAML`
  yamlContent.value = toYAML(crd.value)
  yamlReadOnly.value = true
  activeInstance.value = undefined
  yamlOpen.value = true
}
function openCrdYamlEditor() {
  if (!crd.value) return
  yamlMode.value = 'crd-edit'
  yamlTitle.value = `${crd.value.metadata.name} · 编辑 CRD YAML`
  yamlContent.value = toYAML(crd.value)
  yamlReadOnly.value = false
  activeInstance.value = undefined
  yamlOpen.value = true
}
function openCreateInstance() {
  const definition = instanceDefinition.value
  if (!definition || !canUseInstanceApi.value) return
  yamlMode.value = 'create'
  yamlTitle.value = `创建 ${definition.kind}`
  yamlContent.value = toYAML({
    apiVersion: definition.group ? `${definition.group}/${definition.version}` : definition.version,
    kind: definition.kind,
    metadata: { name: 'example', namespace: definition.namespaced ? scope.namespace : undefined },
    spec: {},
  })
  yamlReadOnly.value = false
  activeInstance.value = undefined
  yamlOpen.value = true
}
async function openInstanceYaml(row: KubeResource, readOnly: boolean) {
  const definition = instanceDefinition.value
  if (!definition) return
  try {
    const response = await resourceApi.get(definition, instanceContext(row))
    activeInstance.value = response
    yamlMode.value = readOnly ? 'view' : 'edit'
    yamlTitle.value = `${response.metadata.name} · ${readOnly ? 'YAML' : '编辑 YAML'}`
    yamlContent.value = toYAML(response)
    yamlReadOnly.value = readOnly
    yamlOpen.value = true
  } catch (reason) {
    ElMessage.error(reason instanceof Error ? reason.message : '实例 YAML 加载失败')
  }
}
async function submitYaml(content: string) {
  if (yamlMode.value === 'crd-edit') await saveCrdYaml(content)
  else await submitInstanceYaml(content)
}
async function saveCrdYaml(content: string) {
  const currentCrd = crd.value
  if (!currentCrd || !scope.cluster || yamlSubmitting.value) return
  yamlSubmitting.value = true
  try {
    const resource = fromYAML<CrdResource>(content)
    if (resource.apiVersion !== 'apiextensions.k8s.io/v1' || resource.kind !== 'CustomResourceDefinition')
      throw new Error('请输入 apiextensions.k8s.io/v1 的 CustomResourceDefinition')
    if (!resource.metadata?.name) throw new Error('CRD 必须包含 metadata.name')
    if (resource.metadata.name !== currentCrd.metadata.name) throw new Error('不能修改 CRD 的 metadata.name')
    await resourceApi.replace(CRD_DEFINITION, { cluster: scope.cluster, name: currentCrd.metadata.name }, resource)
  } catch (reason) {
    // 不关闭对话框、不更新 yamlContent，保留编辑器中的当前草稿供修正后重试。
    ElMessage.error(reason instanceof Error ? reason.message : 'CRD YAML 保存失败')
    return
  } finally {
    yamlSubmitting.value = false
  }

  yamlOpen.value = false
  ElMessage.success(`${currentCrd.metadata.name} 已保存并应用`)
  await loadCrd()
}
async function submitInstanceYaml(content: string) {
  const definition = instanceDefinition.value
  if (!definition || !['create', 'edit'].includes(yamlMode.value) || yamlSubmitting.value) return
  yamlSubmitting.value = true
  try {
    const resource = fromYAML<KubeResource>(content)
    if (!resource.metadata?.name) throw new Error('资源实例必须包含 metadata.name')
    if (resource.kind && resource.kind !== definition.kind) throw new Error(`资源 kind 应为 ${definition.kind}`)
    if (yamlMode.value === 'create') {
      const context = instanceContext(undefined, resource.metadata.namespace)
      if (definition.namespaced && !context.namespace) throw new Error('命名空间级实例必须包含 metadata.namespace')
      await resourceApi.create(definition, context, resource)
      ElMessage.success(`${definition.kind} ${resource.metadata.name} 创建成功`)
    } else {
      if (!activeInstance.value) return
      await resourceApi.replace(definition, instanceContext(activeInstance.value), resource)
      ElMessage.success(`${activeInstance.value.metadata.name} 已保存并应用`)
    }
    yamlOpen.value = false
    await loadInstances()
  } catch (reason) {
    ElMessage.error(reason instanceof Error ? reason.message : '实例 YAML 提交失败')
  } finally {
    yamlSubmitting.value = false
  }
}
async function deleteCrd() {
  const currentCrd = crd.value
  if (!currentCrd || !scope.cluster || deletingCrd.value) return
  const crdName = currentCrd.metadata.name
  const cluster = scope.cluster
  const targetLevel = currentCrd.spec?.scope === 'Namespaced' ? 'Namespaced' : 'Cluster'
  try {
    await ElMessageBox.confirm(
      `删除 CRD 将同时删除其所有自定义资源实例，且无法恢复。确定删除 “${crdName}” 吗？`,
      '删除 CustomResourceDefinition',
      {
        type: 'warning',
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
        confirmButtonClass: 'el-button--danger',
      },
    )
  } catch {
    return
  }

  deletingCrd.value = true
  try {
    await resourceApi.delete(CRD_DEFINITION, { cluster, name: crdName })
  } catch (reason) {
    ElMessage.error(reason instanceof Error ? reason.message : 'CRD 删除失败')
    return
  } finally {
    deletingCrd.value = false
  }

  yamlOpen.value = false
  ElMessage.success(`${crdName} 已删除`)
  await router.push({ name: 'crd.list', params: { level: targetLevel }, query: route.query })
}
async function deleteInstance(row: KubeResource) {
  const definition = instanceDefinition.value
  if (!definition || deletingName.value) return
  try {
    await ElMessageBox.confirm(`删除后无法恢复，确定删除 ${definition.kind} “${row.metadata.name}” 吗？`, '删除自定义资源实例', {
      type: 'warning',
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
      confirmButtonClass: 'el-button--danger',
    })
  } catch {
    return
  }
  deletingName.value = row.metadata.name
  try {
    await resourceApi.delete(definition, instanceContext(row))
    ElMessage.success(`${row.metadata.name} 已删除`)
    await loadInstances()
  } catch (reason) {
    ElMessage.error(reason instanceof Error ? reason.message : '实例删除失败')
  } finally {
    deletingName.value = ''
  }
}

watch(
  [() => route.params.name, () => route.params.version, () => route.params.level, () => scope.cluster, () => scope.namespace],
  () => {
    crd.value = undefined
    instances.value = []
    total.value = 0
    instancePage.value = 1
    yamlOpen.value = false
    void loadCrd()
  },
  { immediate: true },
)
</script>

<style scoped>
.crd-overview {
  padding: 22px 24px;
}
.overview-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border-light);
}
.crd-identity {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.crd-identity__icon {
  display: grid;
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  color: var(--brand-500);
  background: var(--brand-50);
  border-radius: 11px;
  place-items: center;
  font-size: 20px;
}
.crd-identity h2 {
  font-size: 16px;
}
.crd-identity p {
  margin-top: 3px;
  overflow: hidden;
  color: var(--text-tertiary);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.overview-grid {
  display: grid;
  padding: 22px 0;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 22px 32px;
}
.overview-grid > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}
.overview-grid span,
.available-versions > span {
  color: var(--text-tertiary);
  font-size: 11px;
}
.overview-grid strong,
.overview-grid code {
  overflow: hidden;
  color: var(--text-regular);
  font-size: 13px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.overview-grid .el-tag {
  align-self: flex-start;
}
.available-versions {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-light);
}
.available-versions > div {
  display: flex;
  gap: 7px;
  flex-wrap: wrap;
}
.instances-surface {
  overflow: hidden;
}
.instances-toolbar {
  display: flex;
  min-height: 70px;
  padding: 14px 20px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid var(--border-light);
}
.instances-title {
  display: flex;
  align-items: center;
  gap: 9px;
}
.instances-title h2 {
  font-size: 16px;
}
.namespace-hint {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-left: 8px;
  color: var(--text-secondary);
  font-size: 12px;
}
.instance-alert {
  margin: 14px 20px 0;
}
.instance-name {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.instance-name > span {
  display: grid;
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
  color: var(--brand-500);
  background: var(--brand-50);
  border-radius: 7px;
  place-items: center;
}
.instance-name > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
}
.instance-name strong {
  overflow: hidden;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.instance-name small {
  margin-top: 2px;
  color: var(--text-tertiary);
  font-size: 10px;
}
.api-version {
  color: var(--text-secondary);
  font-size: 12px;
}
.row-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
}
.row-actions .el-button {
  margin: 0;
}
.list-footer {
  display: flex;
  min-height: 68px;
  padding: 0 20px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-top: 1px solid var(--border-light);
}
.total-text {
  color: var(--text-secondary);
  font-size: 12px;
}
@media (max-width: 900px) {
  .overview-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 640px) {
  .crd-overview {
    padding: 18px;
  }
  .overview-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  .available-versions {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
  }
  .instances-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }
  .instances-title {
    flex-wrap: wrap;
  }
  .namespace-hint {
    margin-left: 0;
  }
  .list-footer {
    align-items: flex-start;
    flex-direction: column;
    padding-block: 14px;
  }
  .list-footer .el-pagination {
    max-width: 100%;
    overflow-x: auto;
  }
}
</style>
