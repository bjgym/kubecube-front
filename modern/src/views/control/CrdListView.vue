<template>
  <div class="page page-stack crd-list-page">
    <PageHeader
      title="自定义资源"
      description="查看集群中注册的 CustomResourceDefinition，并通过 YAML 扩展 Kubernetes API"
      :breadcrumbs="['资源控制台', '自定义资源']"
    >
      <template #actions>
        <el-button :icon="Refresh" :loading="loading" @click="load">刷新</el-button>
        <el-button type="primary" :icon="Plus" :disabled="!scope.cluster" @click="openCreate">创建 CRD</el-button>
      </template>
    </PageHeader>

    <section class="surface list-surface">
      <el-tabs :model-value="level" class="scope-tabs" @tab-change="onLevelChange">
        <el-tab-pane name="Cluster">
          <template #label
            ><span class="tab-label"
              ><el-icon><Grid /></el-icon>集群级别<el-tag size="small" effect="plain" type="info">Cluster</el-tag></span
            ></template
          >
        </el-tab-pane>
        <el-tab-pane name="Namespaced">
          <template #label
            ><span class="tab-label"
              ><el-icon><Collection /></el-icon>空间级别<el-tag size="small" effect="plain" type="info">Namespaced</el-tag></span
            ></template
          >
        </el-tab-pane>
      </el-tabs>

      <div class="list-toolbar">
        <div class="list-toolbar__description">
          <strong>{{ level === 'Cluster' ? '集群级自定义资源定义' : '命名空间级自定义资源定义' }}</strong>
          <span>{{ level === 'Cluster' ? '其实例在整个集群范围内唯一' : '其实例按命名空间隔离，详情将使用当前空间' }}</span>
        </div>
        <div class="list-toolbar__filters">
          <el-input
            v-model="keyword"
            class="search-input"
            clearable
            placeholder="按 CRD 名称搜索…"
            :prefix-icon="Search"
            @keyup.enter="applySearch"
            @clear="applySearch"
          />
          <el-button type="primary" plain :icon="Search" @click="applySearch">搜索</el-button>
        </div>
      </div>

      <el-alert v-if="error" class="list-error" type="error" :title="error" show-icon :closable="false">
        <template #default><el-button link type="primary" @click="load">重新加载</el-button></template>
      </el-alert>

      <el-table v-loading="loading" :data="items" row-key="metadata.name" @sort-change="onSort">
        <el-table-column prop="metadata.name" label="名称" min-width="250" sortable="custom" show-overflow-tooltip>
          <template #default="{ row }">
            <router-link class="resource-name" :to="detailLocation(row, preferredVersion(row))">
              <span class="resource-icon"
                ><el-icon><Files /></el-icon
              ></span>
              <span
                ><strong>{{ row.metadata.name }}</strong
                ><small>{{ kindOf(row) }}</small></span
              >
            </router-link>
          </template>
        </el-table-column>
        <el-table-column label="API 组" min-width="180" show-overflow-tooltip>
          <template #default="{ row }"
            ><code class="group-name">{{ groupOf(row) }}</code></template
          >
        </el-table-column>
        <el-table-column label="版本" min-width="190">
          <template #default="{ row }">
            <div class="version-links">
              <el-link
                v-for="version in versionsOf(row)"
                :key="version.name"
                type="primary"
                :underline="false"
                :to="detailLocation(row, version.name)"
              >
                {{ version.name }}<el-tag v-if="version.storage" size="small" effect="plain">存储</el-tag>
              </el-link>
              <span v-if="!versionsOf(row).length">—</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="作用域" width="132">
          <template #default="{ row }"
            ><el-tag effect="plain" :type="scopeOf(row) === 'Cluster' ? 'warning' : 'success'">{{ scopeOf(row) }}</el-tag></template
          >
        </el-table-column>
        <el-table-column prop="metadata.creationTimestamp" label="创建时间" width="176" sortable="custom">
          <template #default="{ row }">{{ formatDate(row.metadata.creationTimestamp) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="92" fixed="right" align="right">
          <template #default="{ row }"
            ><el-button link type="primary" @click="openDetail(row, preferredVersion(row))">查看实例</el-button></template
          >
        </el-table-column>
        <template #empty>
          <EmptyState
            :title="
              !scope.cluster ? '尚未选择集群' : appliedSearch ? '没有匹配的 CRD' : `暂无${level === 'Cluster' ? '集群级' : '空间级'} CRD`
            "
            :description="
              !scope.cluster
                ? '请先在顶部工作空间中选择集群'
                : appliedSearch
                  ? '请调整名称关键词，或清除搜索条件后重试'
                  : '可以通过 YAML 创建第一个自定义资源定义'
            "
            :action-text="scope.cluster && !appliedSearch ? '创建 CRD' : undefined"
            @action="openCreate"
          />
        </template>
      </el-table>

      <div class="list-footer">
        <span class="total-text"
          >{{ appliedSearch ? `筛选出 ${total} 项` : `共 ${total} 项`
          }}<template v-if="appliedSearch"> · 关键词“{{ appliedSearch }}”</template></span
        >
        <el-pagination
          background
          :current-page="pageNum"
          :page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next"
          @current-change="onPage"
          @size-change="onPageSize"
        />
      </div>
    </section>

    <YamlEditorDialog
      v-model="yamlOpen"
      title="创建 CustomResourceDefinition"
      :content="yamlContent"
      :submitting="yamlSubmitting"
      @submit="createCrd"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Collection, Files, Grid, Plus, Refresh, Search } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import YamlEditorDialog from '@/components/YamlEditorDialog.vue'
import { resourceApi, type ResourceDefinition } from '@/api/resource'
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
  names?: { kind?: string; plural?: string; singular?: string }
  [key: string]: unknown
}
type CrdResource = KubeResource<CrdSpec>

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
const items = ref<CrdResource[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const keyword = ref('')
const appliedSearch = ref('')
const pageNum = ref(1)
const pageSize = ref(10)
const sortName = ref<string | undefined>('metadata.creationTimestamp')
const sortOrder = ref<'asc' | 'desc'>('desc')
const yamlOpen = ref(false)
const yamlContent = ref('')
const yamlSubmitting = ref(false)
let requestId = 0

const level = computed<'Cluster' | 'Namespaced'>(() => (route.params.level === 'Namespaced' ? 'Namespaced' : 'Cluster'))

function groupOf(row: CrdResource): string {
  return row.spec?.group || '—'
}
function kindOf(row: CrdResource): string {
  return row.spec?.names?.kind || 'CustomResource'
}
function scopeOf(row: CrdResource): string {
  return row.spec?.scope || 'Unknown'
}
function versionsOf(row: CrdResource): CrdVersion[] {
  if (row.spec?.versions?.length) return row.spec.versions
  return row.spec?.version ? [{ name: row.spec.version }] : []
}
function preferredVersion(row: CrdResource): string {
  const versions = versionsOf(row)
  return (
    versions.find((version) => version.storage)?.name ||
    versions.find((version) => version.served !== false)?.name ||
    versions[0]?.name ||
    'v1'
  )
}
function detailLocation(row: CrdResource, version: string): RouteLocationRaw {
  return {
    name: 'crd.detail',
    params: { level: scopeOf(row) === 'Namespaced' ? 'Namespaced' : 'Cluster', name: row.metadata.name, version },
    query: route.query,
  }
}
function openDetail(row: CrdResource, version: string) {
  void router.push(detailLocation(row, version))
}

async function load() {
  const id = ++requestId
  if (!scope.cluster) {
    items.value = []
    total.value = 0
    loading.value = false
    error.value = ''
    return
  }
  loading.value = true
  error.value = ''
  const selectors = [`spec.scope=${level.value}`]
  if (appliedSearch.value) selectors.push(`metadata.name~${appliedSearch.value}`)
  try {
    const response = await resourceApi.list(
      CRD_DEFINITION,
      { cluster: scope.cluster },
      {
        pageNum: pageNum.value,
        pageSize: pageSize.value,
        selector: selectors.join(','),
        sortName: sortName.value,
        sortOrder: sortOrder.value,
        sortFunc: sortName.value === 'metadata.creationTimestamp' ? 'time' : 'string',
      },
    )
    if (id !== requestId) return
    items.value = (response.items || []) as CrdResource[]
    total.value = response.total ?? items.value.length
  } catch (reason) {
    if (id !== requestId) return
    error.value = reason instanceof Error ? reason.message : 'CRD 列表加载失败'
  } finally {
    if (id === requestId) loading.value = false
  }
}

function applySearch() {
  appliedSearch.value = keyword.value.trim()
  pageNum.value = 1
  void load()
}
function onPage(page: number) {
  pageNum.value = page
  void load()
}
function onPageSize(size: number) {
  pageSize.value = size
  pageNum.value = 1
  void load()
}
function onSort({ prop, order }: { prop: string; order: 'ascending' | 'descending' | null }) {
  sortName.value = order ? prop : undefined
  sortOrder.value = order === 'ascending' ? 'asc' : 'desc'
  pageNum.value = 1
  void load()
}
function onLevelChange(name: string | number) {
  const target = name === 'Namespaced' ? 'Namespaced' : 'Cluster'
  if (target === level.value) return
  keyword.value = ''
  appliedSearch.value = ''
  pageNum.value = 1
  void router.push({ name: 'crd.list', params: { level: target }, query: route.query })
}

function defaultCrdYaml(): string {
  const group = 'example.com'
  return toYAML({
    apiVersion: 'apiextensions.k8s.io/v1',
    kind: 'CustomResourceDefinition',
    metadata: { name: `widgets.${group}` },
    spec: {
      group,
      scope: level.value,
      names: { plural: 'widgets', singular: 'widget', kind: 'Widget', shortNames: ['wd'] },
      versions: [
        {
          name: 'v1',
          served: true,
          storage: true,
          schema: { openAPIV3Schema: { type: 'object', 'x-kubernetes-preserve-unknown-fields': true } },
        },
      ],
    },
  })
}
function openCreate() {
  yamlContent.value = defaultCrdYaml()
  yamlOpen.value = true
}
async function createCrd(content: string) {
  if (!scope.cluster || yamlSubmitting.value) return
  yamlSubmitting.value = true
  try {
    const resource = fromYAML<CrdResource>(content)
    if (resource.apiVersion !== 'apiextensions.k8s.io/v1' || resource.kind !== 'CustomResourceDefinition')
      throw new Error('请输入 apiextensions.k8s.io/v1 的 CustomResourceDefinition')
    if (!resource.metadata?.name) throw new Error('CRD 必须包含 metadata.name')
    await resourceApi.create(CRD_DEFINITION, { cluster: scope.cluster }, resource)
    ElMessage.success(`CRD ${resource.metadata.name} 创建成功`)
    yamlOpen.value = false
    await load()
  } catch (reason) {
    ElMessage.error(reason instanceof Error ? reason.message : 'CRD 创建失败')
  } finally {
    yamlSubmitting.value = false
  }
}

watch(
  [() => scope.cluster, level],
  () => {
    pageNum.value = 1
    void load()
  },
  { immediate: true },
)
</script>

<style scoped>
.list-surface {
  overflow: hidden;
}
.scope-tabs {
  padding: 0 20px;
  border-bottom: 1px solid var(--border-light);
}
.scope-tabs :deep(.el-tabs__header) {
  margin: 0;
}
.scope-tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}
.scope-tabs :deep(.el-tabs__item) {
  height: 54px;
}
.tab-label {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}
.tab-label .el-tag {
  margin-left: 3px;
  font-size: 10px;
}
.list-toolbar {
  display: flex;
  min-height: 78px;
  padding: 16px 20px;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  border-bottom: 1px solid var(--border-light);
}
.list-toolbar__description {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}
.list-toolbar__description strong {
  color: var(--text-regular);
  font-size: 13px;
  font-weight: 550;
}
.list-toolbar__description span {
  color: var(--text-tertiary);
  font-size: 11px;
}
.list-toolbar__filters {
  display: flex;
  align-items: center;
  gap: 8px;
}
.search-input {
  width: min(320px, 32vw);
}
.list-error {
  margin: 14px 20px 0;
}
.resource-name {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  color: var(--text-primary);
}
.resource-name:hover strong {
  color: var(--brand-600);
}
.resource-name > span:last-child {
  display: flex;
  min-width: 0;
  flex-direction: column;
}
.resource-name strong {
  overflow: hidden;
  font-size: 13px;
  font-weight: 550;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.resource-name small {
  margin-top: 2px;
  color: var(--text-tertiary);
  font-size: 11px;
}
.resource-icon {
  display: grid;
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  color: var(--brand-500);
  background: var(--brand-50);
  border-radius: 8px;
  place-items: center;
}
.group-name {
  padding: 3px 7px;
  color: var(--text-regular);
  background: var(--surface-subtle);
  border-radius: 5px;
  font-size: 12px;
}
.version-links {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.version-links .el-link {
  gap: 5px;
  font-size: 12px;
}
.version-links .el-tag {
  height: 18px;
  padding: 0 4px;
  font-size: 9px;
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
  .list-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }
  .list-toolbar__filters,
  .search-input {
    width: 100%;
  }
}
@media (max-width: 680px) {
  .list-footer {
    align-items: flex-start;
    flex-direction: column;
    padding-block: 14px;
  }
  .list-footer .el-pagination {
    max-width: 100%;
    overflow-x: auto;
  }
  .scope-tabs {
    padding: 0 12px;
  }
}
</style>
