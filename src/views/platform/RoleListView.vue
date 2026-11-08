<template>
  <div class="page page-stack">
    <PageHeader
      title="角色管理"
      description="按平台、租户和项目层级维护自定义角色。内置角色仅可查看，权限目录由服务端统一下发。"
      :breadcrumbs="['平台管理', '组织管理']"
    >
      <template #actions>
        <el-button type="primary" :icon="Plus" @click="openCreate">新建角色</el-button>
      </template>
    </PageHeader>

    <el-tabs :model-value="identity" class="surface identity-tabs" @tab-change="changeIdentity">
      <el-tab-pane v-for="item in identityOptions" :key="item.name" :label="item.label" :name="item.name" />
    </el-tabs>

    <section class="surface role-layout" aria-label="角色与权限">
      <aside class="role-sidebar">
        <div class="role-sidebar__header">
          <div>
            <h2>{{ currentIdentity.label }}</h2>
            <p>{{ currentIdentity.description }}</p>
          </div>
          <el-button text :icon="Refresh" :loading="rolesLoading" aria-label="刷新角色" @click="loadRoles" />
        </div>
        <el-input v-model="roleKeyword" :prefix-icon="Search" clearable placeholder="搜索角色" aria-label="搜索角色" />
        <el-alert v-if="rolesError && allRoles.length" title="角色刷新失败，仍显示上次数据" type="error" :closable="false" show-icon />
        <div v-loading="rolesLoading" class="role-list">
          <button
            v-for="role in searchedRoles"
            :key="roleName(role)"
            type="button"
            class="role-item"
            :class="{ 'role-item--active': selectedName === roleName(role) }"
            @click="chooseRole(roleName(role))"
          >
            <span class="role-item__icon" aria-hidden="true"
              ><el-icon><User /></el-icon
            ></span>
            <span class="role-item__content">
              <strong>{{ roleDisplayName(role) }}</strong>
              <small>{{ roleName(role) }}</small>
            </span>
            <el-tag v-if="isBuiltin(role)" size="small" effect="plain">内置</el-tag>
          </button>
          <EmptyState
            v-if="!rolesLoading && !searchedRoles.length"
            :title="rolesError ? '角色列表加载失败' : roleKeyword ? '未找到匹配角色' : '暂无角色'"
            :description="rolesError ? '请检查服务状态后重试。' : roleKeyword ? '请更换搜索关键字。' : '可新建一个自定义角色并配置权限。'"
            :action-text="rolesError ? '重新加载' : roleKeyword ? '' : '新建角色'"
            @action="rolesError ? loadRoles() : openCreate()"
          />
        </div>
      </aside>

      <div class="permission-panel">
        <template v-if="selectedRole">
          <div class="permission-header">
            <div>
              <div class="permission-title">
                <h2>{{ roleDisplayName(selectedRole) }}</h2>
                <el-tag v-if="isBuiltin(selectedRole)" type="info" effect="plain">内置角色 · 只读</el-tag>
                <el-tag v-else type="success" effect="plain">自定义角色</el-tag>
              </div>
              <p class="text-secondary">{{ roleDescription(selectedRole) }}</p>
              <p v-if="selectedDetail" class="binding-hint">
                当前有 {{ selectedDetail.holders }} 个绑定主体
                <span v-if="selectedDetail.holders">，解除绑定后才可删除</span>
              </p>
            </div>
            <div class="permission-actions">
              <el-button type="danger" plain :icon="Delete" :disabled="!canDelete" :loading="deleting" @click="removeRole"
                >删除角色</el-button
              >
              <el-button type="primary" :icon="Check" :disabled="!canEdit" :loading="saving" @click="savePermissions">保存权限</el-button>
            </div>
          </div>

          <el-alert
            v-if="isBuiltin(selectedRole)"
            title="内置角色由平台统一维护，权限目录仅供查看，不能保存或删除。"
            type="info"
            :closable="false"
            show-icon
            class="panel-alert"
          />
          <el-alert
            v-if="detailErrorFor === selectedName"
            title="角色权限读取失败，不能确认当前勾选状态；为避免误授权，编辑与删除已暂停。"
            type="error"
            :closable="false"
            show-icon
            class="panel-alert"
          >
            <el-button link type="primary" @click="loadRoleDetail(selectedName)">重新读取</el-button>
          </el-alert>

          <section class="bindings-panel">
            <div class="permission-table-header">
              <div>
                <h3>绑定主体</h3>
                <p>直接读取控制集群的 RoleBinding 与 ClusterRoleBinding，展示使用该角色的用户和 ServiceAccount。</p>
              </div>
              <el-button text :icon="Refresh" :loading="bindingsLoading" aria-label="刷新绑定主体" @click="loadBindings(selectedName)"
                >刷新</el-button
              >
            </div>
            <el-alert v-if="bindingsError" :title="bindingsError" type="warning" :closable="false" show-icon />
            <el-table v-loading="bindingsLoading" :data="bindings" size="small" empty-text="暂无绑定主体">
              <el-table-column label="主体" min-width="180"
                ><template #default="{ row }"
                  ><span class="mono">{{ row.subjectName }}</span></template
                ></el-table-column
              >
              <el-table-column prop="subjectKind" label="类型" width="130" />
              <el-table-column prop="subjectNamespace" label="主体命名空间" min-width="150" />
              <el-table-column label="绑定" min-width="230"
                ><template #default="{ row }"
                  ><span class="mono">{{ row.bindingName }}</span></template
                ></el-table-column
              >
              <el-table-column prop="bindingKind" label="绑定类型" width="170" />
              <el-table-column prop="namespace" label="绑定命名空间" min-width="150" />
            </el-table>
          </section>

          <div v-loading="detailLoading || catalogueLoading" class="permission-content">
            <template v-if="catalogueError && !catalogueItems.length">
              <EmptyState
                title="权限目录加载失败"
                description="未获得可授权项目，页面不会将角色显示为“无权限”。请重试。"
                action-text="重新加载目录"
                @action="loadCatalogue"
              />
            </template>
            <template v-else-if="catalogueItems.length">
              <el-alert
                v-if="catalogueError"
                title="权限目录刷新失败，当前展示上次成功加载的目录。"
                type="warning"
                :closable="false"
                show-icon
                class="panel-alert"
              />
              <div class="permission-table-header">
                <div>
                  <h3>权限目录</h3>
                  <p>逐项勾选读取或写入权限；不属于当前层级的项目不可授权。</p>
                </div>
                <span class="text-secondary">{{ catalogueItems.length }} 项</span>
              </div>
              <el-table :data="permissionRows" row-key="name">
                <el-table-column label="权限项" min-width="190">
                  <template #default="{ row }">
                    <div class="permission-name">
                      <strong>{{ row.name }}</strong>
                      <small v-if="row.disabled">当前层级不可授权</small>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column label="覆盖资源" min-width="220">
                  <template #default="{ row }"
                    ><span class="mono resource-text">{{ row.resources || '—' }}</span></template
                  >
                </el-table-column>
                <el-table-column label="可授权层级" min-width="170">
                  <template #default="{ row }">{{ levelLabels(row.levels) }}</template>
                </el-table-column>
                <el-table-column label="读取" width="90" align="center">
                  <template #default="{ row }">
                    <el-checkbox v-model="row.selection.read" :disabled="!canEdit || row.disabled" :aria-label="`读取 ${row.name}`" />
                  </template>
                </el-table-column>
                <el-table-column label="写入" width="90" align="center">
                  <template #default="{ row }">
                    <el-checkbox v-model="row.selection.write" :disabled="!canEdit || row.disabled" :aria-label="`写入 ${row.name}`" />
                  </template>
                </el-table-column>
              </el-table>
            </template>
            <EmptyState
              v-else-if="!detailLoading && !catalogueLoading"
              title="权限目录为空"
              description="服务端暂未返回可授权项目，因此不能保存权限或判断角色是否为空。"
            />
          </div>
        </template>
        <EmptyState v-else-if="!rolesLoading" title="请选择一个角色" description="从左侧选择角色后，可查看权限目录与绑定情况。" />
      </div>
    </section>

    <el-dialog v-model="createVisible" title="新建角色" width="520px" :close-on-click-modal="!creating" @closed="resetCreate">
      <el-form ref="createFormRef" :model="createModel" :rules="createRules" label-position="top">
        <el-form-item label="角色名称" prop="name">
          <el-input v-model.trim="createModel.name" maxlength="63" placeholder="小写字母、数字或中划线" />
        </el-form-item>
        <el-form-item label="角色层级">
          <el-input :model-value="currentIdentity.label" disabled />
        </el-form-item>
        <el-form-item label="初始权限">
          <el-radio-group v-model="createModel.mode">
            <el-radio value="empty">空权限，创建后再配置</el-radio>
            <el-radio value="inherit">继承 {{ identity }}-admin 的权限</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :disabled="creating" @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="createRole">创建角色</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules, type TabPaneName } from 'element-plus'
import { Check, Delete, Plus, Refresh, Search, User } from '@element-plus/icons-vue'
import { userApi } from '@/api/auth'
import { clusterApi } from '@/api/cluster'
import { resourceApi, type ResourceDefinition } from '@/api/resource'
import { useScopeStore } from '@/stores/scope'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import type { KubeResource, ListResponse } from '@/types/api'

type RoleIdentity = 'platform' | 'tenant' | 'project'
type PermissionVerb = 'read' | 'write' | 'all'
interface CatalogueItem {
  name: string
  resources: string
  levels: string[]
}
interface RoleDetail {
  scope: string
  items: Record<string, PermissionVerb>
  builtin: boolean
  holders: number
}
interface PermissionSelection {
  read: boolean
  write: boolean
}
interface PermissionRow extends CatalogueItem {
  disabled: boolean
  selection: PermissionSelection
}
interface RoleApiExtension {
  clusterRoles?: (level: RoleIdentity) => Promise<ListResponse<KubeResource>>
}
interface RoleBindingRow {
  bindingName: string
  bindingKind: 'ClusterRoleBinding' | 'RoleBinding'
  namespace: string
  subjectKind: string
  subjectName: string
  subjectNamespace: string
}

const route = useRoute()
const router = useRouter()
const scope = useScopeStore()
const roleApi = userApi as typeof userApi & RoleApiExtension
const identityOptions: Array<{ name: RoleIdentity; label: string; description: string }> = [
  { name: 'platform', label: '平台角色', description: '管理平台级资源与组织能力' },
  { name: 'tenant', label: '租户角色', description: '管理租户及其项目资源' },
  { name: 'project', label: '项目角色', description: '管理项目空间内的工作负载' },
]
const validIdentities = identityOptions.map((item) => item.name)
const identity = computed<RoleIdentity>(() => {
  const value = String(route.params.identity || '') as RoleIdentity
  return validIdentities.includes(value) ? value : 'platform'
})
const currentIdentity = computed(() => identityOptions.find((item) => item.name === identity.value) || identityOptions[0]!)

const allRoles = ref<KubeResource[]>([])
const rolesLoading = ref(false)
const rolesError = ref(false)
const roleKeyword = ref('')
const selectedName = ref('')
let rolesGeneration = 0

const catalogueItems = ref<CatalogueItem[]>([])
const catalogueError = ref(false)
const catalogueLoading = ref(false)
const roleDetails = ref<Record<string, RoleDetail>>({})
const permissionDraft = ref<Record<string, PermissionSelection>>({})
const detailLoading = ref(false)
const detailErrorFor = ref('')
let detailGeneration = 0
const bindings = ref<RoleBindingRow[]>([])
const bindingsLoading = ref(false)
const bindingsError = ref('')
const roleBindingDefinition: ResourceDefinition = {
  plural: 'rolebindings',
  kind: 'RoleBinding',
  group: 'rbac.authorization.k8s.io',
  version: 'v1',
  namespaced: false,
}
const clusterRoleBindingDefinition: ResourceDefinition = {
  plural: 'clusterrolebindings',
  kind: 'ClusterRoleBinding',
  group: 'rbac.authorization.k8s.io',
  version: 'v1',
  namespaced: false,
}

const saving = ref(false)
const deleting = ref(false)
const createVisible = ref(false)
const creating = ref(false)
const createFormRef = ref<FormInstance>()
const createModel = reactive({ name: '', mode: 'empty' as 'empty' | 'inherit' })

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function roleName(role: KubeResource): string {
  return role.metadata?.name || String(record(role).name || '')
}

function roleDisplayName(role: KubeResource): string {
  return String(record(role.spec).displayName || record(role.spec).description || roleName(role))
}

function roleDescription(role: KubeResource): string {
  return String(record(role.spec).description || `角色标识：${roleName(role)}`)
}

function normalizeRole(item: unknown): KubeResource | null {
  if (typeof item === 'string' && item) return { metadata: { name: item } }
  const value = record(item)
  const name = String(record(value.metadata).name || value.name || '')
  return name ? ({ ...value, metadata: { ...record(value.metadata), name } } as KubeResource) : null
}

function extractRoles(response: unknown): KubeResource[] | null {
  const data = record(response)
  const direct = data.items
  if (Array.isArray(direct)) return direct.map(normalizeRole).filter((item): item is KubeResource => Boolean(item))
  const clusterItems = record(data.clusterRoles).items
  if (Array.isArray(clusterItems)) return clusterItems.map(normalizeRole).filter((item): item is KubeResource => Boolean(item))
  return null
}

function declaredScope(role: KubeResource): string {
  const labels = record(role.metadata?.labels)
  const spec = record(role.spec)
  return String(labels['kubecube.io/role'] || labels.scope || spec.scope || spec.identity || roleDetails.value[roleName(role)]?.scope || '')
}

function belongsToIdentity(role: KubeResource): boolean {
  const scope = declaredScope(role)
  if (scope) return scope === identity.value
  // 旧列表没有层级标签时，只识别命名明确的内置管理员，不猜测自定义角色层级。
  return roleName(role) === `${identity.value}-admin`
}

const visibleRoles = computed(() =>
  allRoles.value.filter(belongsToIdentity).sort((a, b) => {
    const aBuiltin = roleName(a) === `${identity.value}-admin` ? 0 : 1
    const bBuiltin = roleName(b) === `${identity.value}-admin` ? 0 : 1
    return aBuiltin - bBuiltin || roleName(a).localeCompare(roleName(b))
  }),
)
const searchedRoles = computed(() => {
  const query = roleKeyword.value.trim().toLowerCase()
  if (!query) return visibleRoles.value
  return visibleRoles.value.filter((role) => `${roleName(role)} ${roleDisplayName(role)}`.toLowerCase().includes(query))
})
const selectedRole = computed(() => allRoles.value.find((role) => roleName(role) === selectedName.value))
const selectedDetail = computed(() => roleDetails.value[selectedName.value])

function isBuiltin(role: KubeResource): boolean {
  const detail = roleDetails.value[roleName(role)]
  if (detail) return detail.builtin
  return (
    Boolean(record(role.spec).builtIn || record(role).aggregationRule) ||
    ['platform-admin', 'tenant-admin', 'project-admin', 'reviewer'].includes(roleName(role))
  )
}

const canEdit = computed(() =>
  Boolean(
    selectedRole.value &&
    selectedDetail.value &&
    !isBuiltin(selectedRole.value) &&
    !detailLoading.value &&
    detailErrorFor.value !== selectedName.value &&
    !catalogueError.value &&
    catalogueItems.value.length,
  ),
)
const canDelete = computed(() =>
  Boolean(
    selectedRole.value &&
    selectedDetail.value &&
    !isBuiltin(selectedRole.value) &&
    selectedDetail.value.holders === 0 &&
    detailErrorFor.value !== selectedName.value &&
    !detailLoading.value,
  ),
)

async function loadRoles() {
  const generation = ++rolesGeneration
  rolesLoading.value = true
  try {
    const response: unknown = roleApi.clusterRoles ? await roleApi.clusterRoles(identity.value) : await userApi.roles()
    const items = extractRoles(response)
    if (!items) throw new Error('角色列表响应格式不受支持')
    if (generation !== rolesGeneration) return
    allRoles.value = items
    rolesError.value = false
    const visible = items.filter(belongsToIdentity)
    if (!visible.some((role) => roleName(role) === selectedName.value)) {
      selectedName.value = visible[0] ? roleName(visible[0]) : ''
    }
    if (selectedName.value) await loadRoleDetail(selectedName.value)
  } catch {
    if (generation === rolesGeneration) rolesError.value = true
  } finally {
    if (generation === rolesGeneration) rolesLoading.value = false
  }
}

function parseCatalogue(response: unknown): CatalogueItem[] | null {
  const rawItems = record(response).items
  if (!rawItems || typeof rawItems !== 'object' || Array.isArray(rawItems)) return null
  return Object.entries(record(rawItems))
    .map(([name, value]) => {
      const item = record(value)
      return {
        name,
        resources: String(item.resources || ''),
        levels: Array.isArray(item.levels) ? item.levels.map(String) : [],
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

async function loadCatalogue() {
  catalogueLoading.value = true
  try {
    const items = parseCatalogue(await userApi.catalogue())
    if (!items) throw new Error('权限目录响应格式不受支持')
    catalogueItems.value = items
    catalogueError.value = false
    syncDraft(selectedDetail.value?.items || {})
  } catch {
    catalogueError.value = true
  } finally {
    catalogueLoading.value = false
  }
}

function parseRoleDetail(role: KubeResource, response: unknown): RoleDetail | null {
  const data = record(response)
  if (!data.items || typeof data.items !== 'object' || Array.isArray(data.items)) return null
  const items: Record<string, PermissionVerb> = {}
  Object.entries(record(data.items)).forEach(([name, value]) => {
    const verb = String(record(value).verb || value)
    if (verb === 'read' || verb === 'write' || verb === 'all') items[name] = verb
  })
  return {
    scope: String(data.scope || declaredScope(role) || identity.value),
    items,
    builtin: Boolean(data.builtin) || isBuiltin(role),
    holders: Math.max(0, Number(data.holders || 0)),
  }
}

async function loadBindings(role: string) {
  if (!role) return
  bindingsLoading.value = true
  bindingsError.value = ''
  try {
    let cluster = scope.controlCluster
    if (!cluster) {
      const response = await clusterApi.list({ pageNum: 1, pageSize: 100 })
      cluster = response.items?.find((item) => !item.isMemberCluster)?.clusterName || response.items?.[0]?.clusterName || ''
    }
    if (!cluster) {
      bindingsError.value = '未找到控制集群，无法读取 RoleBinding。'
      bindings.value = []
      return
    }
    const context = { cluster, namespace: '' }
    const results = await Promise.allSettled([
      resourceApi.list(clusterRoleBindingDefinition, context, { pageNum: 1, pageSize: 500 }),
      resourceApi.list(roleBindingDefinition, context, { pageNum: 1, pageSize: 500 }),
    ])
    const rows: RoleBindingRow[] = []
    let failed = 0
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        failed++
        return
      }
      const bindingKind = index === 0 ? 'ClusterRoleBinding' : 'RoleBinding'
      for (const binding of result.value.items || []) {
        if (String((binding.roleRef as Record<string, unknown> | undefined)?.name || '') !== role) continue
        const subjects = Array.isArray(binding.subjects) ? binding.subjects : []
        if (!subjects.length) {
          rows.push({
            bindingName: binding.metadata.name,
            bindingKind,
            namespace: binding.metadata.namespace || '—',
            subjectKind: '—',
            subjectName: '无绑定主体',
            subjectNamespace: '—',
          })
          continue
        }
        for (const subject of subjects as Array<Record<string, unknown>>) {
          rows.push({
            bindingName: binding.metadata.name,
            bindingKind,
            namespace: binding.metadata.namespace || '—',
            subjectKind: String(subject.kind || '—'),
            subjectName: String(subject.name || '—'),
            subjectNamespace: String(subject.namespace || '—'),
          })
        }
      }
    })
    bindings.value = rows
    if (failed === results.length) bindingsError.value = 'RoleBinding 读取失败，无法确认绑定主体。'
    else if (failed) bindingsError.value = '部分绑定读取失败，当前列表可能不完整。'
  } catch (error) {
    bindingsError.value = `绑定主体读取失败：${error instanceof Error ? error.message : '请求失败'}`
  } finally {
    bindingsLoading.value = false
  }
}
async function loadRoleDetail(name: string) {
  if (!name) return
  const generation = ++detailGeneration
  const role = allRoles.value.find((item) => roleName(item) === name)
  if (!role) return
  detailLoading.value = true
  detailErrorFor.value = ''
  try {
    const detail = parseRoleDetail(role, await userApi.roleItems(name))
    if (!detail) throw new Error('角色权限响应格式不受支持')
    if (generation !== detailGeneration || selectedName.value !== name) return
    roleDetails.value = { ...roleDetails.value, [name]: detail }
    detailErrorFor.value = ''
    syncDraft(detail.items)
    void loadBindings(name)
  } catch {
    if (generation === detailGeneration) detailErrorFor.value = name
  } finally {
    if (generation === detailGeneration) detailLoading.value = false
  }
}

function syncDraft(items: Record<string, PermissionVerb>) {
  const draft: Record<string, PermissionSelection> = {}
  catalogueItems.value.forEach((item) => {
    const verb = items[item.name]
    draft[item.name] = { read: verb === 'read' || verb === 'all', write: verb === 'write' || verb === 'all' }
  })
  permissionDraft.value = draft
}

const permissionRows = computed<PermissionRow[]>(() =>
  catalogueItems.value.map((item) => ({
    ...item,
    disabled: !item.levels.includes(identity.value),
    selection: permissionDraft.value[item.name] || { read: false, write: false },
  })),
)

function levelLabels(levels: string[]): string {
  const labels: Record<string, string> = { platform: '平台', tenant: '租户', project: '项目' }
  return levels.map((level) => labels[level] || level).join('、') || '—'
}

function chooseRole(name: string) {
  if (selectedName.value === name) return
  selectedName.value = name
  detailErrorFor.value = ''
  syncDraft(roleDetails.value[name]?.items || {})
  void loadRoleDetail(name)
}

function changeIdentity(name: TabPaneName) {
  const next = String(name) as RoleIdentity
  if (validIdentities.includes(next) && next !== identity.value) {
    void router.push({ name: 'platform.role.manage', params: { identity: next } })
  }
}

const createRules: FormRules = {
  name: [
    { required: true, message: '请输入角色名称', trigger: 'blur' },
    { pattern: /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/, message: '请使用小写字母、数字或中划线，并以字母或数字开头和结尾', trigger: 'blur' },
  ],
}

function openCreate() {
  Object.assign(createModel, { name: '', mode: 'empty' })
  createVisible.value = true
}

function resetCreate() {
  createFormRef.value?.clearValidate()
  Object.assign(createModel, { name: '', mode: 'empty' })
}

async function createRole() {
  const valid = await createFormRef.value?.validate().catch(() => false)
  if (!valid) return
  creating.value = true
  const name = createModel.name
  try {
    let items: Record<string, PermissionVerb> = {}
    if (createModel.mode === 'inherit') {
      const adminRole = allRoles.value.find((role) => roleName(role) === `${identity.value}-admin`) || {
        metadata: { name: `${identity.value}-admin` },
      }
      const detail = parseRoleDetail(adminRole, await userApi.roleItems(`${identity.value}-admin`))
      if (!detail) throw new Error('无法读取待继承角色的权限')
      items = detail.items
    }
    await userApi.saveRoleItems(name, { scope: identity.value, items })
    ElMessage.success('角色创建成功')
    createVisible.value = false
    selectedName.value = name
    await loadRoles()
  } catch {
    // 保留新建表单，请求层已展示失败原因。
  } finally {
    creating.value = false
  }
}

async function savePermissions() {
  const role = selectedRole.value
  if (!role || !canEdit.value) return
  const items: Record<string, PermissionVerb> = {}
  permissionRows.value.forEach((row) => {
    if (row.disabled) return
    if (row.selection.read && row.selection.write) items[row.name] = 'all'
    else if (row.selection.read) items[row.name] = 'read'
    else if (row.selection.write) items[row.name] = 'write'
  })
  saving.value = true
  try {
    await userApi.saveRoleItems(roleName(role), { scope: identity.value, items })
    roleDetails.value = {
      ...roleDetails.value,
      [roleName(role)]: { ...selectedDetail.value!, items },
    }
    ElMessage.success('角色权限已保存')
  } catch {
    // 保存失败时保留所有勾选，便于修正后重试。
  } finally {
    saving.value = false
  }
}

async function removeRole() {
  const role = selectedRole.value
  if (!role || !canDelete.value) return
  const name = roleName(role)
  try {
    await ElMessageBox.confirm(`删除后无法恢复，且角色 ${name} 的权限配置将一并移除。确认继续吗？`, '删除角色', {
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
      type: 'warning',
      confirmButtonClass: 'el-button--danger',
    })
  } catch {
    return
  }
  deleting.value = true
  try {
    await userApi.deleteRole(name)
    ElMessage.success('角色已删除')
    const remaining = { ...roleDetails.value }
    delete remaining[name]
    roleDetails.value = remaining
    selectedName.value = ''
    await loadRoles()
  } catch {
    // 删除失败时保留角色与权限目录。
  } finally {
    deleting.value = false
  }
}

watch(identity, (next, previous) => {
  if (next === previous) return
  selectedName.value = ''
  detailErrorFor.value = ''
  detailGeneration++
  syncDraft({})
  void loadRoles()
})

onMounted(() => {
  if (String(route.params.identity || '') !== identity.value) {
    void router.replace({ name: 'platform.role.manage', params: { identity: identity.value } })
  }
  void loadCatalogue()
  void loadRoles()
})
</script>

<style scoped>
.identity-tabs {
  padding: 0 20px;
}
.identity-tabs :deep(.el-tabs__header) {
  margin: 0;
}
.identity-tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}
.role-layout {
  display: grid;
  grid-template-columns: 290px minmax(0, 1fr);
  min-height: 620px;
  overflow: hidden;
}
.role-sidebar {
  display: flex;
  min-width: 0;
  padding: 22px 16px;
  border-right: 1px solid var(--border-light);
  flex-direction: column;
  gap: 16px;
  background: var(--surface-subtle);
}
.role-sidebar__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding: 0 4px;
}
.role-sidebar__header h2 {
  font-size: 16px;
}
.role-sidebar__header p {
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 18px;
}
.role-list {
  display: flex;
  min-height: 320px;
  flex-direction: column;
  gap: 6px;
}
.role-item {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  gap: 10px;
  padding: 12px 10px;
  color: var(--text-regular);
  text-align: left;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  transition:
    background 160ms var(--ease),
    border-color 160ms var(--ease);
}
.role-item:hover {
  background: var(--brand-50);
}
.role-item--active {
  background: var(--brand-50);
  border-color: var(--brand-200);
}
.role-item__icon {
  display: grid;
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
  color: var(--brand-600);
  background: #fff;
  border-radius: 8px;
  place-items: center;
}
.role-item__content {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}
.role-item__content strong,
.role-item__content small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.role-item__content strong {
  font-size: 13px;
}
.role-item__content small {
  margin-top: 2px;
  color: var(--text-tertiary);
  font-size: 11px;
}
.permission-panel {
  min-width: 0;
  padding: 24px;
}
.permission-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border-light);
}
.permission-title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}
.permission-title h2 {
  font-size: 20px;
}
.permission-header p {
  margin-top: 7px;
}
.binding-hint {
  color: var(--text-tertiary);
  font-size: 12px;
}
.permission-actions {
  display: flex;
  flex-shrink: 0;
  gap: 10px;
}
.panel-alert {
  margin-top: 18px;
}
.bindings-panel {
  margin-top: 22px;
  padding-top: 20px;
  border-top: 1px solid var(--border-subtle);
}
.permission-content {
  min-height: 360px;
  padding-top: 4px;
}
.permission-table-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 0 14px;
}
.permission-table-header h3 {
  font-size: 15px;
}
.permission-table-header p {
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 12px;
}
.permission-name {
  display: flex;
  flex-direction: column;
}
.permission-name small {
  margin-top: 3px;
  color: var(--warning);
}
.resource-text {
  color: var(--text-secondary);
  font-size: 12px;
  white-space: normal;
  word-break: break-word;
}
@media (max-width: 1100px) {
  .role-layout {
    grid-template-columns: 240px minmax(0, 1fr);
  }
  .permission-header {
    flex-direction: column;
  }
}
@media (max-width: 768px) {
  .identity-tabs {
    padding: 0 12px;
  }
  .role-layout {
    display: block;
  }
  .role-sidebar {
    border-right: 0;
    border-bottom: 1px solid var(--border-light);
  }
  .role-list {
    min-height: 0;
  }
  .permission-panel {
    padding: 18px 14px;
  }
  .permission-actions {
    width: 100%;
    flex-wrap: wrap;
  }
  .permission-actions .el-button {
    margin-left: 0;
  }
}
</style>
