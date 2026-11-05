<template>
  <div class="page page-stack">
    <PageHeader :title="config.title" :description="config.description" :breadcrumbs="['资源控制台', scope.namespace || '未选择空间']">
      <template #actions>
        <el-button @click="ui.yamlComposerOpen = true"
          ><el-icon><DocumentAdd /></el-icon>YAML 编排</el-button
        >
        <el-tooltip :disabled="writeAllowed" content="当前空间只有只读权限"
          ><el-button v-if="config.canCreate" type="primary" :disabled="!writeAllowed" @click="createResource"
            ><el-icon><Plus /></el-icon>{{ config.createLabel || `创建${config.shortTitle}` }}</el-button
          ></el-tooltip
        >
      </template>
    </PageHeader>

    <section class="surface list-surface">
      <div class="list-toolbar">
        <div class="list-toolbar__left">
          <el-input
            :model-value="search"
            clearable
            placeholder="按名称搜索…"
            class="search-input"
            @input="onSearchInput"
            @keyup.enter="onSearch(search)"
            ><template #prefix
              ><el-icon><Search /></el-icon></template></el-input
          ><span v-if="search" class="filter-result">筛选结果 {{ total }} 项</span>
        </div>
        <div class="list-toolbar__right">
          <el-checkbox v-model="autoRefresh">自动刷新</el-checkbox
          ><el-button :loading="loading" @click="load"
            ><el-icon><Refresh /></el-icon>刷新</el-button
          >
        </div>
      </div>
      <el-alert
        v-if="error"
        class="list-error"
        type="error"
        :title="error"
        description="已保留当前列表数据，请检查连接后重试。"
        show-icon
        :closable="false"
      />
      <el-table
        v-loading="loading && !items.length"
        :data="items"
        row-key="metadata.uid"
        @sort-change="onSort"
        @selection-change="selected = $event"
      >
        <el-table-column type="selection" width="44" :selectable="(row: KubeResource) => writeAllowed && !isProtectedResource(row)" />
        <el-table-column
          v-for="column in config.columns"
          :key="column.prop"
          :prop="column.prop"
          :label="column.label"
          :width="column.width"
          :min-width="column.minWidth"
          :sortable="column.sortable ? 'custom' : false"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <router-link
              v-if="column.prop === 'metadata.name'"
              class="resource-name"
              :to="{ path: `/control/${config.key}/${row.metadata.name}/info`, query: scope.query }"
              ><span class="resource-icon"
                ><el-icon><Box /></el-icon></span
              ><span>{{ row.metadata.name }}</span></router-link
            >
            <StatusTag v-else-if="column.kind === 'status'" :status="valueForColumn(row, column)" />
            <span v-else :class="{ mono: column.prop.includes('IP') || column.prop.includes('schedule') }">{{
              valueForColumn(row, column)
            }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="178" fixed="right" align="right">
          <template #default="{ row }"
            ><div class="row-actions">
              <el-button link type="primary" @click="openDetail(row)">详情</el-button>
              <el-button v-if="config.canEdit" link type="primary" :disabled="!writeAllowed" @click="editResource(row)">设置</el-button>
              <el-dropdown trigger="click" @command="(command: string) => onCommand(command, row)"
                ><el-button link class="more-button" aria-label="更多操作"
                  ><el-icon><MoreFilled /></el-icon></el-button
                ><template #dropdown
                  ><el-dropdown-menu>
                    <el-dropdown-item command="yaml"
                      ><el-icon><Document /></el-icon>{{ config.key === 'pods' ? '查看 YAML' : 'YAML 设置' }}</el-dropdown-item
                    >
                    <el-dropdown-item v-if="config.canScale" command="scale" :disabled="!writeAllowed"
                      ><el-icon><ScaleToOriginal /></el-icon>调整副本数</el-dropdown-item
                    >
                    <el-dropdown-item v-if="config.key === 'deployments'" command="updateImage" :disabled="!writeAllowed"
                      ><el-icon><Upload /></el-icon>滚动更新</el-dropdown-item
                    >
                    <el-dropdown-item v-if="config.canRestart" command="restart" :disabled="!writeAllowed"
                      ><el-icon><RefreshRight /></el-icon>重建</el-dropdown-item
                    >
                    <el-dropdown-item command="delete" :disabled="!writeAllowed || isProtectedResource(row)" divided
                      ><span class="danger-text"
                        ><el-icon><Delete /></el-icon>删除</span
                      ></el-dropdown-item
                    >
                  </el-dropdown-menu></template
                ></el-dropdown
              >
            </div></template
          >
        </el-table-column>
        <template #empty
          ><EmptyState
            :title="search ? '没有匹配的资源' : `暂无${config.shortTitle}`"
            :description="
              search
                ? '尝试更换关键词或清除搜索条件'
                : config.canCreate
                  ? '创建第一个资源，开始管理你的云原生应用'
                  : '当前空间中还没有相关资源'
            "
            :action-text="config.canCreate && writeAllowed && !search ? config.createLabel || `创建${config.shortTitle}` : undefined"
            @action="createResource"
        /></template>
      </el-table>
      <div class="list-footer">
        <el-button v-if="selected.length" type="danger" plain @click="deleteSelected">删除已选 {{ selected.length }} 项</el-button
        ><span v-else class="total-text">共 {{ total }} 项</span
        ><el-pagination
          background
          :current-page="pagination.pageNum"
          :page-size="pagination.pageSize"
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
      :title="`${yamlResource?.metadata.name || ''} · YAML`"
      :content="yamlContent"
      :read-only="config.key === 'pods' || !writeAllowed"
      :submitting="yamlSubmitting"
      @submit="saveYaml"
    />
    <el-dialog v-model="scaleOpen" title="调整副本数" width="440px"
      ><p class="dialog-description">
        为 <strong>{{ activeResource?.metadata.name }}</strong> 设置期望副本数。
      </p>
      <el-input-number v-model="replicas" :min="0" :max="1000" /><template #footer
        ><el-button @click="scaleOpen = false">取消</el-button
        ><el-button type="primary" :loading="actionLoading" @click="saveReplicas">确认调整</el-button></template
      ></el-dialog
    >
  </div>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Box,
  Delete,
  Document,
  DocumentAdd,
  MoreFilled,
  Plus,
  Refresh,
  RefreshRight,
  ScaleToOriginal,
  Search,
  Upload,
} from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import YamlEditorDialog from '@/components/YamlEditorDialog.vue'
import { resourceApi } from '@/api/resource'
import { getResourceConfig, valueForColumn } from '@/config/resources'
import { useResourceList } from '@/composables/useResourceList'
import { useScopeStore } from '@/stores/scope'
import { useUiStore } from '@/stores/ui'
import { fromYAML, toYAML } from '@/utils/yaml'
import type { KubeResource } from '@/types/api'
const route = useRoute()
const router = useRouter()
const scope = useScopeStore()
const ui = useUiStore()
const config = computed(() => getResourceConfig(String(route.params.workload))!)
const projectNamespace = computed(() => String((scope.currentProject?.spec as Record<string, unknown> | undefined)?.namespace || ''))
const context = computed(() => ({
  cluster: scope.cluster,
  namespace: ['PrometheusRule', 'AlertmanagerConfig'].includes(config.value.key)
    ? projectNamespace.value || scope.namespace
    : scope.namespace,
}))
const { items, total, loading, error, search, pagination, load, onSearch, onPage, onPageSize, onSort } = useResourceList(config, context)
const writeAllowed = computed(() => scope.canWrite(config.value.key) || scope.canWrite(config.value.plural))
function isProtectedResource(row: KubeResource) {
  const metadata = row.metadata as Record<string, any>
  return (
    config.value.key === 'secrets' &&
    (metadata.labels?.['system/defaultImagePullSecret'] === 'true' || metadata.pureLabels?.['system/defaultImagePullSecret'] === 'true')
  )
}
const autoRefresh = ref(false)
const selected = ref<KubeResource[]>([])
const yamlOpen = ref(false)
const yamlContent = ref('')
const yamlResource = ref<KubeResource>()
const yamlSubmitting = ref(false)
const scaleOpen = ref(false)
const activeResource = ref<KubeResource>()
const replicas = ref(1)
const actionLoading = ref(false)
let timer: ReturnType<typeof setInterval> | undefined
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(autoRefresh, (value) => {
  clearInterval(timer)
  if (value) timer = setInterval(load, 30_000)
})
onBeforeUnmount(() => {
  clearInterval(timer)
  clearTimeout(searchTimer)
})
function onSearchInput(value: string) {
  search.value = value
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => onSearch(value), 400)
}
const detailPath = (row: KubeResource) => `/control/${config.value.key}/${row.metadata.name}/info`
const openDetail = (row: KubeResource) => router.push({ path: detailPath(row), query: scope.query })
const createResource = () => router.push({ path: `/control/${config.value.key}/create`, query: scope.query })
const editResource = (row: KubeResource) =>
  router.push({ path: `/control/${config.value.key}/${row.metadata.name}/edit`, query: scope.query })
async function onCommand(command: string, row: KubeResource) {
  if (command === 'yaml') await openYaml(row)
  else if (command === 'delete') await remove(row)
  else if (command === 'scale') openScale(row)
  else if (command === 'restart') await restart(row)
  else if (command === 'updateImage')
    router.push({ path: `/control/${config.value.key}/${row.metadata.name}/updateImage`, query: scope.query })
}
async function openYaml(row: KubeResource) {
  const response = await resourceApi.get(config.value, { ...context.value, name: row.metadata.name })
  yamlResource.value = response
  yamlContent.value = toYAML(response)
  yamlOpen.value = true
}
async function saveYaml(content: string) {
  if (!yamlResource.value) return
  yamlSubmitting.value = true
  try {
    await resourceApi.replace(config.value, { ...context.value, name: yamlResource.value.metadata.name }, fromYAML(content))
    ElMessage.success('YAML 已保存并应用')
    yamlOpen.value = false
    await load()
  } finally {
    yamlSubmitting.value = false
  }
}
function openScale(row: KubeResource) {
  activeResource.value = row
  replicas.value = Number((row.spec as Record<string, unknown> | undefined)?.replicas || 1)
  scaleOpen.value = true
}
async function saveReplicas() {
  if (!activeResource.value) return
  actionLoading.value = true
  try {
    await resourceApi.patch(
      config.value,
      { ...context.value, name: activeResource.value.metadata.name },
      { spec: { replicas: replicas.value } },
    )
    ElMessage.success(`副本数已调整为 ${replicas.value}`)
    scaleOpen.value = false
    await load()
  } finally {
    actionLoading.value = false
  }
}
async function restart(row: KubeResource) {
  await ElMessageBox.confirm(`将按滚动策略重建 ${row.metadata.name} 的副本，是否继续？`, '重建工作负载', {
    type: 'warning',
    confirmButtonText: '确认重建',
  })
  await resourceApi.patch(
    config.value,
    { ...context.value, name: row.metadata.name },
    { spec: { template: { metadata: { annotations: { 'kubectl.kubernetes.io/restartedAt': new Date().toISOString() } } } } },
  )
  ElMessage.success('已触发重建')
  await load()
}
async function remove(row: KubeResource) {
  if (isProtectedResource(row)) {
    ElMessage.warning('默认镜像拉取 Secret 不能删除')
    return
  }
  await ElMessageBox.confirm(`删除后无法恢复，确定删除 ${config.value.shortTitle} “${row.metadata.name}” 吗？`, '删除资源', {
    type: 'warning',
    confirmButtonText: '确认删除',
    confirmButtonClass: 'el-button--danger',
  })
  await resourceApi.delete(config.value, { ...context.value, name: row.metadata.name })
  ElMessage.success(`${row.metadata.name} 已删除`)
  await load()
}
async function deleteSelected() {
  const rows = [...selected.value]
  await ElMessageBox.confirm(`确定删除选中的 ${rows.length} 个资源吗？此操作无法撤销。`, '批量删除', {
    type: 'warning',
    confirmButtonText: '确认删除',
  })
  await Promise.all(rows.map((row) => resourceApi.delete(config.value, { ...context.value, name: row.metadata.name })))
  ElMessage.success(`已删除 ${rows.length} 个资源`)
  selected.value = []
  await load()
}
</script>
<style scoped>
.list-surface {
  overflow: hidden;
}
.list-toolbar {
  display: flex;
  min-height: 66px;
  padding: 14px 18px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid var(--border-light);
}
.list-toolbar__left,
.list-toolbar__right {
  display: flex;
  align-items: center;
  gap: 14px;
}
.search-input {
  width: min(340px, 42vw);
}
.filter-result,
.total-text {
  color: var(--text-secondary);
  font-size: 12px;
}
.list-error {
  margin: 14px 18px 0;
}
.resource-name {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 9px;
  color: var(--brand-600);
  font-weight: 500;
}
.resource-name:hover span:last-child {
  text-decoration: underline;
}
.resource-icon {
  display: grid;
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  color: var(--brand-500);
  background: var(--brand-50);
  border-radius: 6px;
  place-items: center;
}
.row-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 5px;
}
.more-button {
  padding: 8px !important;
  color: var(--text-secondary);
  font-size: 18px;
}
.danger-text {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--danger);
}
.list-footer {
  display: flex;
  min-height: 68px;
  padding: 0 18px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-top: 1px solid var(--border-light);
}
.list-footer .el-pagination {
  margin-top: 0;
}
.dialog-description {
  margin-bottom: 20px;
  color: var(--text-secondary);
}
@media (max-width: 768px) {
  .list-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }
  .list-toolbar__left,
  .list-toolbar__right {
    width: 100%;
  }
  .search-input {
    width: 100%;
  }
  .list-footer {
    align-items: flex-start;
    flex-direction: column;
    padding-block: 14px;
  }
}
</style>
