<template>
  <div class="page page-stack">
    <PageHeader
      title="租户与项目"
      description="统一管理租户、项目及成员授权。所有资源操作均在当前管控集群执行。"
      :breadcrumbs="['平台管理', '组织管理']"
    >
      <template #badge>
        <el-tag v-if="scope.controlCluster" effect="plain" type="info">管控集群：{{ scope.controlCluster }}</el-tag>
      </template>
      <template #actions>
        <el-button v-if="activeTab !== 'member'" type="primary" :icon="Plus" @click="createCurrent">
          {{ activeTab === 'tenant' ? '新增租户' : '新增项目' }}
        </el-button>
        <el-button v-else type="primary" :icon="Plus" @click="openAddMember">添加成员</el-button>
      </template>
    </PageHeader>

    <section v-loading="controlLoading" class="surface management-surface">
      <el-tabs :model-value="activeTab" class="management-tabs" @tab-change="changeTab">
        <el-tab-pane label="租户管理" name="tenant" />
        <el-tab-pane label="项目管理" name="project" />
        <el-tab-pane label="成员管理" name="member" />
      </el-tabs>

      <el-alert
        v-if="controlError"
        title="无法确定管控集群，资源请求尚未执行。请检查集群信息后重试。"
        type="error"
        :closable="false"
        show-icon
        class="content-alert"
      >
        <el-button link type="primary" @click="initialize">重新加载</el-button>
      </el-alert>

      <div v-if="activeTab === 'tenant'" class="tab-content">
        <div class="toolbar">
          <el-input v-model="listKeyword" class="filter-input" :prefix-icon="Search" clearable placeholder="搜索租户名称或标识" />
          <el-button text :icon="Refresh" :loading="tenantsLoading" @click="loadTenants">刷新</el-button>
        </div>
        <el-alert
          v-if="tenantsError && tenants.length"
          title="租户列表刷新失败，仍显示上次成功加载的数据。"
          type="error"
          :closable="false"
          show-icon
        />
        <el-table v-loading="tenantsLoading" :data="filteredTenants" :row-key="resourceName">
          <el-table-column label="租户名称" min-width="180">
            <template #default="{ row }">
              <div class="resource-name">
                <strong>{{ displayName(row) }}</strong
                ><small>{{ resourceName(row) }}</small>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="描述" min-width="220">
            <template #default="{ row }">{{ text(record(row.spec).description) }}</template>
          </el-table-column>
          <el-table-column label="租户命名空间" min-width="210">
            <template #default="{ row }"
              ><span class="mono">{{ tenantNamespace(row) }}</span></template
            >
          </el-table-column>
          <el-table-column label="创建时间" min-width="170">
            <template #default="{ row }">{{ formatDate(row.metadata.creationTimestamp) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="250" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openEditScope('tenants', row)">修改名称</el-button>
              <el-button link type="primary" @click="openCreateScope('projects', resourceName(row))">添加项目</el-button>
              <el-button link type="primary" @click="goToMembers('tenant', resourceName(row))">成员</el-button>
            </template>
          </el-table-column>
          <template #empty>
            <EmptyState
              :title="tenantsError ? '租户列表加载失败' : listKeyword ? '未找到匹配租户' : '暂无租户'"
              :description="tenantsError ? '请稍后重试。' : listKeyword ? '请更换搜索关键字。' : '创建租户后，可继续配置配额与项目。'"
              :action-text="tenantsError ? '重新加载' : listKeyword ? '' : '新增租户'"
              @action="tenantsError ? loadTenants() : openCreateScope('tenants')"
            />
          </template>
        </el-table>
      </div>

      <div v-else-if="activeTab === 'project'" class="tab-content">
        <div class="toolbar">
          <div class="toolbar__group">
            <el-select v-model="selectedTenant" class="tenant-filter" filterable placeholder="全部租户" clearable @change="onTenantChange">
              <el-option v-for="tenant in tenants" :key="resourceName(tenant)" :label="displayName(tenant)" :value="resourceName(tenant)" />
            </el-select>
            <el-input v-model="listKeyword" class="filter-input" :prefix-icon="Search" clearable placeholder="搜索项目名称或标识" />
          </div>
          <el-button text :icon="Refresh" :loading="projectsLoading" @click="loadProjects">刷新</el-button>
        </div>
        <el-alert
          v-if="projectsError && projects.length"
          title="项目列表刷新失败，仍显示上次成功加载的数据。"
          type="error"
          :closable="false"
          show-icon
        />
        <el-table v-loading="projectsLoading" :data="filteredProjects" :row-key="resourceName">
          <el-table-column label="项目名称" min-width="180">
            <template #default="{ row }">
              <div class="resource-name">
                <strong>{{ displayName(row) }}</strong
                ><small>{{ resourceName(row) }}</small>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="所属租户" min-width="150">
            <template #default="{ row }">{{ tenantDisplayName(projectTenant(row)) }}</template>
          </el-table-column>
          <el-table-column label="描述" min-width="200">
            <template #default="{ row }">{{ text(record(row.spec).description) }}</template>
          </el-table-column>
          <el-table-column label="项目命名空间" min-width="210">
            <template #default="{ row }"
              ><span class="mono">{{ projectNamespace(row) }}</span></template
            >
          </el-table-column>
          <el-table-column label="创建时间" min-width="170">
            <template #default="{ row }">{{ formatDate(row.metadata.creationTimestamp) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="280" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openEditScope('projects', row)">修改名称</el-button>
              <el-button link type="primary" @click="openDomainSuffix(row)">域名后缀</el-button>
              <el-button link type="primary" @click="goToMembers('project', resourceName(row), projectTenant(row))">成员</el-button>
            </template>
          </el-table-column>
          <template #empty>
            <EmptyState
              :title="projectsError ? '项目列表加载失败' : listKeyword ? '未找到匹配项目' : '暂无项目'"
              :description="projectsError ? '请稍后重试。' : listKeyword ? '请更换搜索条件。' : '选择所属租户并创建第一个项目。'"
              :action-text="projectsError ? '重新加载' : listKeyword ? '' : '新增项目'"
              @action="projectsError ? loadProjects() : openCreateScope('projects')"
            />
          </template>
        </el-table>
      </div>

      <div v-else class="tab-content">
        <div class="member-filters">
          <el-radio-group v-model="memberScope" aria-label="成员范围" @change="onMemberScopeChange">
            <el-radio-button value="tenant">租户成员</el-radio-button>
            <el-radio-button value="project">项目成员</el-radio-button>
          </el-radio-group>
          <el-select v-model="selectedTenant" filterable placeholder="选择租户" @change="onTenantChange">
            <el-option v-for="tenant in tenants" :key="resourceName(tenant)" :label="displayName(tenant)" :value="resourceName(tenant)" />
          </el-select>
          <el-select v-if="memberScope === 'project'" v-model="selectedProject" filterable placeholder="选择项目">
            <el-option
              v-for="project in projectsInTenant"
              :key="resourceName(project)"
              :label="displayName(project)"
              :value="resourceName(project)"
            />
          </el-select>
          <el-select v-model="roleFilter" filterable clearable placeholder="全部角色">
            <el-option v-for="role in roleOptions" :key="role" :label="role" :value="role" />
          </el-select>
          <el-input v-model="memberKeyword" :prefix-icon="Search" clearable placeholder="搜索成员账号" />
        </div>
        <div class="member-toolbar">
          <p class="text-secondary">成员数据来自账号的 scopeBindings；添加与移除由授权绑定接口执行。</p>
          <el-button text :icon="Refresh" :loading="membersLoading" @click="refreshMembers">刷新</el-button>
        </div>
        <el-alert
          v-if="membersError && users.length"
          title="成员数据刷新失败，仍显示上次成功加载的数据。"
          type="error"
          :closable="false"
          show-icon
        />
        <el-alert v-if="rolesError" title="角色选项加载失败，保留已有选项；成员列表不受影响。" type="warning" :closable="false" show-icon />
        <el-alert
          v-if="userTotal > users.length"
          :title="`当前仅加载 ${users.length} / ${userTotal} 个账号，成员列表可能不完整。`"
          type="warning"
          :closable="false"
          show-icon
        />

        <el-table v-loading="membersLoading" :data="filteredMembers" row-key="id">
          <el-table-column label="成员账号" min-width="180">
            <template #default="{ row }">
              <div class="resource-name">
                <strong>{{ row.displayName }}</strong
                ><small>{{ row.userName }}</small>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="角色" min-width="160">
            <template #default="{ row }"
              ><el-tag effect="plain">{{ row.role }}</el-tag></template
            >
          </el-table-column>
          <el-table-column label="授权范围" min-width="150">
            <template #default="{ row }">{{ row.scopeType === 'tenant' ? '租户' : '项目' }} / {{ row.scopeName }}</template>
          </el-table-column>
          <el-table-column label="所属租户" min-width="150" prop="tenant" />
          <el-table-column v-if="memberScope === 'project'" label="所属项目" min-width="150" prop="project" />
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{ row }"><el-button link type="danger" @click="removeMember(row)">移除成员</el-button></template>
          </el-table-column>
          <template #empty>
            <EmptyState
              :title="membersError ? '成员数据加载失败' : '当前范围暂无成员'"
              :description="
                membersError ? '请检查服务后重试。' : selectedTenant ? '可添加成员并为其分配当前范围内的角色。' : '请先选择租户与项目范围。'
              "
              :action-text="membersError ? '重新加载' : selectedTenant ? '添加成员' : ''"
              @action="membersError ? loadMembers() : openAddMember()"
            />
          </template>
        </el-table>
      </div>
    </section>

    <el-dialog
      v-model="scopeDialogVisible"
      :title="scopeDialogTitle"
      width="560px"
      :close-on-click-modal="!scopeSaving"
      @closed="resetScopeForm"
    >
      <el-form ref="scopeFormRef" :model="scopeModel" :rules="scopeRules" label-position="top">
        <el-form-item v-if="scopeKind === 'projects'" label="所属租户" prop="tenant">
          <el-select v-model="scopeModel.tenant" filterable :disabled="scopeDialogMode === 'edit'" placeholder="请选择租户">
            <el-option v-for="tenant in tenants" :key="resourceName(tenant)" :label="displayName(tenant)" :value="resourceName(tenant)" />
          </el-select>
        </el-form-item>
        <el-form-item :label="scopeKind === 'tenants' ? '租户名称' : '项目名称'" prop="displayName">
          <el-input v-model.trim="scopeModel.displayName" maxlength="63" placeholder="用于页面展示的名称" />
        </el-form-item>
        <el-form-item v-if="scopeDialogMode === 'create'" :label="scopeKind === 'tenants' ? '租户标识' : '项目标识'" prop="name">
          <el-input v-model.trim="scopeModel.name" maxlength="63" placeholder="小写字母、数字或中划线" />
          <p class="form-help">全局唯一，创建后不可修改。</p>
        </el-form-item>
        <el-form-item v-if="scopeKind === 'projects' && scopeDialogMode === 'create'" label="项目描述" prop="description">
          <el-input v-model.trim="scopeModel.description" type="textarea" :rows="3" maxlength="128" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :disabled="scopeSaving" @click="scopeDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="scopeSaving" @click="submitScope">{{
          scopeDialogMode === 'create' ? '创建' : '保存修改'
        }}</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="domainDialogVisible"
      title="定制域名后缀"
      width="640px"
      :close-on-click-modal="!domainSaving"
      @closed="resetDomainForm"
    >
      <div class="domain-heading">
        <div>
          <strong>{{ domainProject ? displayName(domainProject) : '' }}</strong>
          <p>用于负载均衡（Ingress）转发规则的域名后缀。移除全部后缀后保存，可清空项目配置。</p>
        </div>
        <el-button :icon="Plus" :disabled="domainSaving" @click="addDomainSuffix">添加后缀</el-button>
      </div>
      <div v-if="domainSuffixes.length" class="domain-list">
        <div v-for="(suffix, index) in domainSuffixes" :key="index" class="domain-row">
          <span class="domain-index">后缀 {{ index + 1 }}</span>
          <el-input
            v-model="domainSuffixes[index]"
            :disabled="domainSaving"
            placeholder="例如：apps.example.com"
            :aria-label="`域名后缀 ${index + 1}`"
            @input="domainError = ''"
            @keyup.enter="submitDomainSuffixes"
          />
          <el-button
            text
            type="danger"
            :disabled="domainSaving"
            :aria-label="`删除域名后缀 ${index + 1}`"
            @click="removeDomainSuffix(index)"
            >删除</el-button
          >
        </div>
      </div>
      <div v-else class="domain-empty">暂未配置域名后缀，点击“添加后缀”开始配置。</div>
      <el-alert v-if="domainError" :title="domainError" type="error" :closable="false" show-icon class="domain-error" />
      <template #footer>
        <el-button :disabled="domainSaving" @click="domainDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="domainSaving" @click="submitDomainSuffixes">保存配置</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="memberDialogVisible" title="添加成员" width="560px" :close-on-click-modal="!memberSaving" @closed="resetMemberForm">
      <el-form label-position="top">
        <div class="form-grid">
          <el-form-item label="授权范围" required>
            <el-input :model-value="memberScope === 'tenant' ? '租户' : '项目'" disabled />
          </el-form-item>
          <el-form-item label="所属租户" required>
            <el-input :model-value="tenantDisplayName(selectedTenant)" disabled />
          </el-form-item>
        </div>
        <el-form-item v-if="memberScope === 'project'" label="所属项目" required>
          <el-input :model-value="projectDisplayName(selectedProject)" disabled />
        </el-form-item>
        <el-form-item label="成员账号" required>
          <el-select v-model="memberModel.userName" filterable placeholder="请选择账号">
            <el-option
              v-for="user in users"
              :key="userName(user)"
              :label="`${userDisplayName(user)}（${userName(user)}）`"
              :value="userName(user)"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="角色" required>
          <el-select v-model="memberModel.role" filterable placeholder="请选择角色">
            <el-option v-for="role in roleOptions" :key="role" :label="role" :value="role" />
          </el-select>
          <p class="form-help">最终可授权范围由后端再次校验。</p>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :disabled="memberSaving" @click="memberDialogVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!canSubmitMember" :loading="memberSaving" @click="submitMember">确认添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules, type TabPaneName } from 'element-plus'
import { Plus, Refresh, Search } from '@element-plus/icons-vue'
import { scopeApi } from '@/api/scope'
import { clusterApi } from '@/api/cluster'
import { userApi } from '@/api/auth'
import { useScopeStore } from '@/stores/scope'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { formatDate } from '@/utils/format'
import type { KubeResource } from '@/types/api'

type ManagementTab = 'tenant' | 'project' | 'member'
type MemberScope = 'tenant' | 'project'
type ScopeKind = 'tenants' | 'projects'
interface MemberRow {
  id: string
  userName: string
  displayName: string
  role: string
  scopeType: MemberScope
  scopeName: string
  tenant: string
  project: string
  namespace: string
  bindingName: string
}

const route = useRoute()
const router = useRouter()
const scope = useScopeStore()
const bindingApi = userApi
const activeTab = computed<ManagementTab>(() => {
  const tab = String(route.params.tab || '')
  return tab === 'project' || tab === 'member' ? tab : 'tenant'
})

const controlLoading = ref(false)
const controlError = ref(false)
const tenants = ref<KubeResource[]>([])
const projects = ref<KubeResource[]>([])
const users = ref<KubeResource[]>([])
const roles = ref<KubeResource[]>([])
const userTotal = ref(0)
const tenantsLoading = ref(false)
const projectsLoading = ref(false)
const membersLoading = ref(false)
const rolesLoading = ref(false)
const tenantsError = ref(false)
const projectsError = ref(false)
const membersError = ref(false)
const rolesError = ref(false)
const listKeyword = ref('')
const memberKeyword = ref('')
const roleFilter = ref('')
const selectedTenant = ref(String(route.query.tenant || ''))
const selectedProject = ref(String(route.query.project || ''))
const memberScope = ref<MemberScope>(route.query.project ? 'project' : 'tenant')
let tenantGeneration = 0
let projectGeneration = 0
let memberGeneration = 0

const scopeDialogVisible = ref(false)
const scopeDialogMode = ref<'create' | 'edit'>('create')
const scopeKind = ref<ScopeKind>('tenants')
const scopeSaving = ref(false)
const scopeFormRef = ref<FormInstance>()
const scopeModel = reactive({ name: '', displayName: '', description: '', tenant: '' })

const domainDialogVisible = ref(false)
const domainSaving = ref(false)
const domainProject = ref<KubeResource | null>(null)
const domainSuffixes = ref<string[]>([])
const domainError = ref('')

const memberDialogVisible = ref(false)
const memberSaving = ref(false)
const memberModel = reactive({ userName: '', role: '' })

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function text(value: unknown, fallback = '—'): string {
  if (value === undefined || value === null || value === '') return fallback
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

function resourceName(resource: KubeResource): string {
  return resource.metadata?.name || text(record(resource).name, '')
}

function displayName(resource: KubeResource): string {
  return text(record(resource.spec).displayName, resourceName(resource))
}

function projectTenant(project: KubeResource): string {
  return text(record(project.metadata?.labels)['kubecube.io/tenant'] ?? record(project.spec).tenant, '')
}

function tenantNamespace(tenant: KubeResource): string {
  return text(record(tenant.spec).namespace, `kubecube-tenant-${resourceName(tenant)}`)
}

function projectNamespace(project: KubeResource): string {
  return text(record(project.spec).namespace, `kubecube-project-${resourceName(project)}`)
}

function userName(user: KubeResource): string {
  return resourceName(user)
}

function userDisplayName(user: KubeResource): string {
  return displayName(user)
}

function tenantDisplayName(name: string): string {
  const tenant = tenants.value.find((item) => resourceName(item) === name)
  return tenant ? displayName(tenant) : text(name, '')
}

function projectDisplayName(name: string): string {
  const project = projects.value.find((item) => resourceName(item) === name)
  return project ? displayName(project) : text(name, '')
}

const projectsInTenant = computed(() =>
  selectedTenant.value ? projects.value.filter((project) => projectTenant(project) === selectedTenant.value) : projects.value,
)
const filteredTenants = computed(() => filterResources(tenants.value, listKeyword.value))
const filteredProjects = computed(() => filterResources(projectsInTenant.value, listKeyword.value))

function filterResources(items: KubeResource[], keyword: string): KubeResource[] {
  const query = keyword.trim().toLowerCase()
  if (!query) return items
  return items.filter((item) =>
    `${resourceName(item)} ${displayName(item)} ${text(record(item.spec).description, '')}`.toLowerCase().includes(query),
  )
}

const roleOptions = computed(() => {
  const options = roles.value.map(resourceName).filter(Boolean)
  return [...new Set(options)].sort((a, b) => a.localeCompare(b))
})

const memberRows = computed<MemberRow[]>(() => {
  if (!selectedTenant.value || (memberScope.value === 'project' && !selectedProject.value)) return []
  const scopeName = memberScope.value === 'tenant' ? selectedTenant.value : selectedProject.value
  const rows: MemberRow[] = []
  users.value.forEach((user) => {
    const bindings = record(user.spec).scopeBindings
    if (!Array.isArray(bindings)) return
    bindings.forEach((value) => {
      const binding = record(value)
      if (binding.scopeType !== memberScope.value || binding.scopeName !== scopeName) return
      const role = text(binding.role, '')
      if (!role) return
      const tenant = memberScope.value === 'tenant' ? scopeName : selectedTenant.value
      const project = memberScope.value === 'project' ? scopeName : ''
      const scopeResource =
        memberScope.value === 'tenant'
          ? tenants.value.find((item) => resourceName(item) === selectedTenant.value)
          : projects.value.find((item) => resourceName(item) === selectedProject.value)
      const namespace = scopeResource
        ? memberScope.value === 'tenant'
          ? tenantNamespace(scopeResource)
          : projectNamespace(scopeResource)
        : `kubecube-${memberScope.value}-${scopeName}`
      rows.push({
        id: `${userName(user)}-${memberScope.value}-${scopeName}-${role}`,
        userName: userName(user),
        displayName: userDisplayName(user),
        role,
        scopeType: memberScope.value,
        scopeName,
        tenant,
        project,
        namespace,
        bindingName: `${userName(user)}-in-${namespace}`,
      })
    })
  })
  return rows.sort((a, b) => a.userName.localeCompare(b.userName) || a.role.localeCompare(b.role))
})

const filteredMembers = computed(() =>
  memberRows.value.filter((member) => {
    if (roleFilter.value && member.role !== roleFilter.value) return false
    const query = memberKeyword.value.trim().toLowerCase()
    return !query || `${member.userName} ${member.displayName}`.toLowerCase().includes(query)
  }),
)

const canSubmitMember = computed(() =>
  Boolean(
    selectedTenant.value &&
    (memberScope.value === 'tenant' || selectedProject.value) &&
    memberModel.userName &&
    memberModel.role &&
    !memberSaving.value,
  ),
)

const scopeDialogTitle = computed(() => {
  const resource = scopeKind.value === 'tenants' ? '租户' : '项目'
  return scopeDialogMode.value === 'create' ? `新增${resource}` : `修改${resource}名称`
})

const scopeRules: FormRules = {
  tenant: [{ required: true, message: '请选择所属租户', trigger: 'change' }],
  displayName: [{ required: true, message: '请输入展示名称', trigger: 'blur' }],
  name: [
    { required: true, message: '请输入资源标识', trigger: 'blur' },
    { pattern: /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/, message: '请使用小写字母、数字或中划线，并以字母或数字开头和结尾', trigger: 'blur' },
  ],
}

async function initialize() {
  controlLoading.value = true
  controlError.value = false
  try {
    if (!scope.controlCluster) {
      const response = await clusterApi.list({ prune: true })
      scope.clusters = response.items || []
    }
    if (!scope.controlCluster) throw new Error('未找到管控集群')
    await Promise.all([loadTenants(), loadProjects(), loadMembers(), loadRoles()])
  } catch {
    controlError.value = true
  } finally {
    controlLoading.value = false
  }
}

async function loadTenants() {
  if (!scope.controlCluster) return
  const generation = ++tenantGeneration
  tenantsLoading.value = true
  try {
    const response = await scopeApi.list(scope.controlCluster, 'tenants', { pageNum: 1, pageSize: 100 })
    if (generation !== tenantGeneration) return
    tenants.value = response.items || []
    tenantsError.value = false
    if (!tenants.value.some((item) => resourceName(item) === selectedTenant.value)) {
      selectedTenant.value = resourceName(tenants.value[0] || ({ metadata: { name: '' } } as KubeResource))
    }
  } catch {
    if (generation === tenantGeneration) tenantsError.value = true
  } finally {
    if (generation === tenantGeneration) tenantsLoading.value = false
  }
}

async function loadProjects() {
  if (!scope.controlCluster) return
  const generation = ++projectGeneration
  projectsLoading.value = true
  try {
    const response = await scopeApi.list(scope.controlCluster, 'projects', { pageNum: 1, pageSize: 100 })
    if (generation !== projectGeneration) return
    projects.value = response.items || []
    projectsError.value = false
    if (selectedProject.value && !projectsInTenant.value.some((item) => resourceName(item) === selectedProject.value)) {
      selectedProject.value = resourceName(projectsInTenant.value[0] || ({ metadata: { name: '' } } as KubeResource))
    } else if (!selectedProject.value) {
      selectedProject.value = resourceName(projectsInTenant.value[0] || ({ metadata: { name: '' } } as KubeResource))
    }
  } catch {
    if (generation === projectGeneration) projectsError.value = true
  } finally {
    if (generation === projectGeneration) projectsLoading.value = false
  }
}

async function loadMembers() {
  const generation = ++memberGeneration
  membersLoading.value = true
  try {
    const response = await userApi.list({ pageNum: 1, pageSize: 100 })
    if (generation !== memberGeneration) return
    users.value = response.items || []
    userTotal.value = Number(response.total ?? users.value.length)
    membersError.value = false
  } catch {
    if (generation === memberGeneration) membersError.value = true
  } finally {
    if (generation === memberGeneration) membersLoading.value = false
  }
}

function extractRoles(response: unknown): KubeResource[] {
  const data = record(response)
  const items = Array.isArray(data.items)
    ? data.items
    : Array.isArray(record(data.clusterRoles).items)
      ? (record(data.clusterRoles).items as unknown[])
      : []
  return items
    .map((item) => {
      if (typeof item === 'string') return { metadata: { name: item } }
      const value = record(item)
      return {
        ...value,
        metadata: { ...record(value.metadata), name: text(record(value.metadata).name ?? value.name, '') },
      } as KubeResource
    })
    .filter((item) => resourceName(item))
}

async function loadRoles() {
  rolesLoading.value = true
  try {
    const response = await userApi.clusterRoles(memberScope.value)
    roles.value = extractRoles(response)
    rolesError.value = false
  } catch {
    rolesError.value = true
  } finally {
    rolesLoading.value = false
  }
}

async function refreshMembers() {
  await Promise.all([loadMembers(), loadRoles()])
}

function onTenantChange() {
  selectedProject.value = resourceName(projectsInTenant.value[0] || ({ metadata: { name: '' } } as KubeResource))
  if (memberDialogVisible.value) memberDialogVisible.value = false
}

function onMemberScopeChange() {
  roleFilter.value = ''
  void loadRoles()
}

function changeTab(name: TabPaneName) {
  const tab = String(name) as ManagementTab
  if (!['tenant', 'project', 'member'].includes(tab)) return
  listKeyword.value = ''
  void router.push({
    name: 'platform.tenant',
    params: { tab },
    query: {
      tenant: selectedTenant.value || undefined,
      project: tab === 'member' && memberScope.value === 'project' ? selectedProject.value || undefined : undefined,
    },
  })
}

function createCurrent() {
  openCreateScope(activeTab.value === 'project' ? 'projects' : 'tenants')
}

function openCreateScope(kind: ScopeKind, tenant = '') {
  scopeKind.value = kind
  scopeDialogMode.value = 'create'
  Object.assign(scopeModel, { name: '', displayName: '', description: '', tenant: tenant || selectedTenant.value })
  scopeDialogVisible.value = true
}

function openEditScope(kind: ScopeKind, resource: KubeResource) {
  scopeKind.value = kind
  scopeDialogMode.value = 'edit'
  Object.assign(scopeModel, {
    name: resourceName(resource),
    displayName: text(record(resource.spec).displayName, ''),
    description: text(record(resource.spec).description, ''),
    tenant: kind === 'projects' ? projectTenant(resource) : '',
  })
  scopeDialogVisible.value = true
}

function resetScopeForm() {
  scopeFormRef.value?.clearValidate()
  Object.assign(scopeModel, { name: '', displayName: '', description: '', tenant: '' })
}

const domainSuffixPattern = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/

function openDomainSuffix(project: KubeResource) {
  const configured = record(project.spec).ingressDomainSuffix
  domainProject.value = project
  domainSuffixes.value = Array.isArray(configured) ? configured.map(String) : configured ? [String(configured)] : []
  domainError.value = ''
  domainDialogVisible.value = true
}

function resetDomainForm() {
  domainProject.value = null
  domainSuffixes.value = []
  domainError.value = ''
}

function addDomainSuffix() {
  domainSuffixes.value.push('')
  domainError.value = ''
}

function removeDomainSuffix(index: number) {
  domainSuffixes.value.splice(index, 1)
  domainError.value = ''
}

async function submitDomainSuffixes() {
  const project = domainProject.value
  if (!project || !scope.controlCluster || domainSaving.value) return
  const suffixes = domainSuffixes.value.map((suffix) => suffix.trim())
  if (suffixes.some((suffix) => !suffix)) {
    domainError.value = '域名后缀不能为空，请填写完整后缀或删除空白行'
    return
  }
  if (new Set(suffixes.map((suffix) => suffix.toLowerCase())).size !== suffixes.length) {
    domainError.value = '域名后缀不能重复，请检查后再保存'
    return
  }
  const invalid = suffixes.find((suffix) => !domainSuffixPattern.test(suffix))
  if (invalid) {
    domainError.value = `域名后缀“${invalid}”格式不正确，请输入例如 apps.example.com 的域名`
    return
  }
  domainSaving.value = true
  domainError.value = ''
  try {
    await scopeApi.patch(scope.controlCluster, 'projects', resourceName(project), { spec: { ingressDomainSuffix: suffixes } })
    ElMessage.success('项目域名后缀已保存')
    domainDialogVisible.value = false
    await loadProjects()
  } catch {
    domainError.value = '域名后缀保存失败，请检查网络或权限后重试'
  } finally {
    domainSaving.value = false
  }
}

async function submitScope() {
  const valid = await scopeFormRef.value?.validate().catch(() => false)
  if (!valid || !scope.controlCluster) return
  scopeSaving.value = true
  try {
    if (scopeDialogMode.value === 'edit') {
      await scopeApi.patch(scope.controlCluster, scopeKind.value, scopeModel.name, { spec: { displayName: scopeModel.displayName } })
      ElMessage.success(`${scopeKind.value === 'tenants' ? '租户' : '项目'}名称已更新`)
    } else if (scopeKind.value === 'tenants') {
      await scopeApi.create(scope.controlCluster, 'tenants', {
        apiVersion: 'tenant.kubecube.io/v1',
        kind: 'Tenant',
        metadata: { name: scopeModel.name },
        spec: { displayName: scopeModel.displayName },
      })
      ElMessage.success('租户创建成功')
    } else {
      await scopeApi.create(scope.controlCluster, 'projects', {
        apiVersion: 'tenant.kubecube.io/v1',
        kind: 'Project',
        metadata: { name: scopeModel.name, labels: { 'kubecube.io/tenant': scopeModel.tenant } },
        spec: { displayName: scopeModel.displayName, description: scopeModel.description },
      })
      selectedTenant.value = scopeModel.tenant
      ElMessage.success('项目创建成功')
    }
    scopeDialogVisible.value = false
    await (scopeKind.value === 'tenants' ? loadTenants() : loadProjects())
  } catch {
    // 保留表单和原列表，请求层已提示失败原因。
  } finally {
    scopeSaving.value = false
  }
}

function goToMembers(type: MemberScope, name: string, tenant = '') {
  memberScope.value = type
  if (type === 'tenant') {
    selectedTenant.value = name
    selectedProject.value = ''
  } else {
    selectedTenant.value = tenant || projectTenant(projects.value.find((item) => resourceName(item) === name) || { metadata: { name: '' } })
    selectedProject.value = name
  }
  void loadRoles()
  void router.push({
    name: 'platform.tenant',
    params: { tab: 'member' },
    query: { tenant: selectedTenant.value, project: type === 'project' ? name : undefined },
  })
}

function openAddMember() {
  if (!selectedTenant.value || (memberScope.value === 'project' && !selectedProject.value)) {
    ElMessage.warning('请先选择完整的成员授权范围')
    return
  }
  Object.assign(memberModel, {
    userName: userName(users.value[0] || ({ metadata: { name: '' } } as KubeResource)),
    role: roleOptions.value.includes(`${memberScope.value}-admin`) ? `${memberScope.value}-admin` : roleOptions.value[0] || '',
  })
  memberDialogVisible.value = true
}

function resetMemberForm() {
  Object.assign(memberModel, { userName: '', role: '' })
}

function currentBindingPayload(): unknown {
  const tenant = selectedTenant.value
  const project = memberScope.value === 'project' ? selectedProject.value : ''
  const scopeName = project || tenant
  const scopeResource =
    memberScope.value === 'tenant'
      ? tenants.value.find((item) => resourceName(item) === tenant)
      : projects.value.find((item) => resourceName(item) === project)
  const namespace = scopeResource
    ? memberScope.value === 'tenant'
      ? tenantNamespace(scopeResource)
      : projectNamespace(scopeResource)
    : `kubecube-${memberScope.value}-${scopeName}`
  const labels: Record<string, string> = { 'kubecube.io/rbac': 'true', 'kubecube.io/tenant': tenant }
  if (project) labels['kubecube.io/project'] = project
  return {
    apiVersion: 'rbac.authorization.k8s.io/v1',
    kind: 'RoleBinding',
    metadata: {
      name: `${memberModel.userName}-in-${namespace}`,
      namespace,
      labels,
      annotations: { 'kubecube.io/sync': 'true' },
    },
    roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'ClusterRole', name: memberModel.role },
    subjects: [{ kind: 'User', name: memberModel.userName }],
  }
}

async function submitMember() {
  if (!canSubmitMember.value) return
  const scopeName = memberScope.value === 'tenant' ? selectedTenant.value : selectedProject.value
  if (memberRows.value.some((member) => member.userName === memberModel.userName)) {
    ElMessage.warning(`账号 ${memberModel.userName} 已是 ${scopeName} 的成员`)
    return
  }
  memberSaving.value = true
  try {
    await bindingApi.createBinding(currentBindingPayload())
    ElMessage.success('成员添加成功')
    memberDialogVisible.value = false
    await loadMembers()
  } catch {
    // 保留成员表单，失败时不改变旧列表。
  } finally {
    memberSaving.value = false
  }
}

async function removeMember(member: MemberRow) {
  try {
    await ElMessageBox.confirm(`将撤销账号 ${member.userName} 在 ${member.scopeName} 中的 ${member.role} 角色。确认继续吗？`, '移除成员', {
      confirmButtonText: '确认移除',
      cancelButtonText: '取消',
      type: 'warning',
      confirmButtonClass: 'el-button--danger',
    })
  } catch {
    return
  }
  try {
    await bindingApi.deleteBinding({ name: member.bindingName, namespace: member.namespace })
    ElMessage.success('成员已移除')
    await loadMembers()
  } catch {
    // 删除失败时保留成员列表。
  }
}

watch(activeTab, (next, previous) => {
  if (next === previous) return
  listKeyword.value = ''
  if (next === 'member') void Promise.all([loadMembers(), loadRoles()])
})

onMounted(initialize)
</script>

<style scoped>
.management-surface {
  overflow: hidden;
}
.management-tabs {
  padding: 0 24px;
  border-bottom: 1px solid var(--border-light);
}
.management-tabs :deep(.el-tabs__header) {
  margin: 0;
}
.management-tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}
.content-alert {
  margin: 20px 24px 0;
}
.tab-content {
  display: flex;
  min-height: 480px;
  padding: 22px 24px 24px;
  flex-direction: column;
  gap: 18px;
}
.filter-input {
  width: 300px;
}
.tenant-filter {
  width: 210px;
}
.resource-name {
  display: flex;
  min-width: 0;
  flex-direction: column;
}
.resource-name strong,
.resource-name small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.resource-name small {
  margin-top: 3px;
  color: var(--text-tertiary);
  font-size: 12px;
}
.member-filters {
  display: grid;
  grid-template-columns: auto minmax(150px, 1fr) minmax(150px, 1fr) minmax(150px, 1fr) minmax(180px, 1.2fr);
  gap: 12px;
  align-items: center;
}
.member-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.member-toolbar p {
  font-size: 12px;
}
.domain-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 20px;
}
.domain-heading p {
  max-width: 430px;
  margin-top: 6px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 20px;
}
.domain-list {
  display: flex;
  max-height: 320px;
  padding-right: 4px;
  overflow-y: auto;
  flex-direction: column;
  gap: 12px;
}
.domain-row {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
}
.domain-index {
  color: var(--text-secondary);
  font-size: 13px;
}
.domain-empty {
  padding: 28px 18px;
  color: var(--text-tertiary);
  text-align: center;
  background: var(--surface-subtle);
  border: 1px dashed var(--border-regular);
  border-radius: 10px;
}
.domain-error {
  margin-top: 18px;
}
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.form-help {
  margin-top: 5px;
  color: var(--text-tertiary);
  font-size: 12px;
}
.dialog-alert {
  margin-bottom: 20px;
}
.el-select {
  width: 100%;
}
@media (max-width: 1200px) {
  .member-filters {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .member-filters .el-radio-group {
    grid-column: 1 / -1;
  }
}
@media (max-width: 768px) {
  .management-tabs {
    padding: 0 14px;
    overflow-x: auto;
  }
  .tab-content {
    padding: 18px 14px;
  }
  .filter-input,
  .tenant-filter {
    width: 100%;
  }
  .toolbar__group {
    width: 100%;
  }
  .member-filters {
    grid-template-columns: 1fr;
  }
  .member-filters .el-radio-group {
    grid-column: auto;
  }
  .member-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }
  .domain-heading {
    flex-direction: column;
  }
  .domain-row {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .domain-index {
    grid-column: 1 / -1;
  }
  .form-grid {
    grid-template-columns: 1fr;
    gap: 0;
  }
}
</style>
