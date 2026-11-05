<template>
  <div class="page page-stack">
    <PageHeader
      title="快速开始"
      description="按租户、配额、项目、成员和空间的顺序完成初始化。创建状态只在接口成功后更新，跳转管理页不会被记为已完成。"
      :breadcrumbs="['平台管理', '组织管理']"
    >
      <template #badge><el-tag effect="plain" type="info">5 步初始化向导</el-tag></template>
    </PageHeader>

    <el-alert v-if="controlError" title="管控集群信息加载失败，暂时无法读取或创建租户与项目。" type="error" :closable="false" show-icon>
      <el-button link type="primary" @click="initialize">重新加载</el-button>
    </el-alert>
    <el-alert
      v-if="dataError"
      title="部分基础数据刷新失败，已保留上次数据与当前表单；请稍后重试。"
      type="warning"
      :closable="false"
      show-icon
    >
      <el-button link type="primary" @click="refreshResources">重试</el-button>
    </el-alert>

    <section v-loading="initializing" class="surface wizard-layout">
      <nav class="step-nav" aria-label="初始化步骤">
        <button
          v-for="(step, index) in steps"
          :key="step.key"
          type="button"
          class="step-button"
          :class="{ 'step-button--active': activeStep === step.key, 'step-button--created': createdSteps[step.key] }"
          :aria-current="activeStep === step.key ? 'step' : undefined"
          @click="goStep(step.key)"
        >
          <span class="step-number">
            <el-icon v-if="createdSteps[step.key]"><Check /></el-icon>
            <template v-else>{{ index + 1 }}</template>
          </span>
          <span class="step-copy">
            <strong>{{ step.title }}</strong>
            <small>{{ step.description }}</small>
            <em>{{ stepStatus(step.key) }}</em>
          </span>
        </button>
      </nav>

      <div class="wizard-content">
        <div class="wizard-heading">
          <div>
            <span class="step-eyebrow">步骤 {{ activeIndex + 1 }} / {{ steps.length }}</span>
            <h2>{{ currentStep.title }}</h2>
            <p>{{ currentStep.longDescription }}</p>
          </div>
          <el-button :icon="TopRight" @click="openManagementPage">{{ currentStep.linkText }}</el-button>
        </div>

        <div v-if="activeStep === 'tenant'" class="step-panel">
          <el-alert
            v-if="createdSteps.tenant"
            :title="`租户 ${createdTenantName} 已由本向导创建，可继续配置配额。`"
            type="success"
            :closable="false"
            show-icon
          />
          <el-form ref="tenantFormRef" :model="tenantModel" :rules="scopeRules" label-position="top" class="create-form">
            <el-form-item label="租户名称" prop="displayName">
              <el-input v-model.trim="tenantModel.displayName" maxlength="63" placeholder="例如：数字零售事业部" />
            </el-form-item>
            <el-form-item label="租户标识" prop="name">
              <el-input v-model.trim="tenantModel.name" maxlength="63" placeholder="例如：digital-retail" />
              <p class="form-help">小写字母、数字或中划线，创建后不可修改。</p>
            </el-form-item>
            <el-button type="primary" :disabled="!scope.controlCluster" :loading="creatingTenant" @click="createTenant">创建租户</el-button>
          </el-form>
        </div>

        <div v-else-if="activeStep === 'quota'" class="step-panel">
          <el-alert
            title="配额需要在专用管理页中按集群可用资源精细配置。本向导不会将打开页面或选择租户视为配额已配置。"
            type="info"
            :closable="false"
            show-icon
          />
          <div class="selection-card">
            <el-form label-position="top">
              <div class="form-grid">
                <el-form-item label="租户">
                  <el-select v-model="selectedTenant" filterable placeholder="请选择租户" @change="onTenantChange">
                    <el-option
                      v-for="tenant in tenants"
                      :key="resourceName(tenant)"
                      :label="displayName(tenant)"
                      :value="resourceName(tenant)"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item label="目标集群">
                  <el-select v-model="selectedCluster" filterable placeholder="请选择成员集群" @change="syncSpaceCluster">
                    <el-option
                      v-for="cluster in memberClusters"
                      :key="cluster.clusterName"
                      :label="cluster.clusterDisplayName || cluster.clusterName"
                      :value="cluster.clusterName"
                    />
                  </el-select>
                </el-form-item>
              </div>
            </el-form>
            <div class="selection-summary">
              <span>将配置</span>
              <strong>{{ selectedTenant || '未选择租户' }}</strong>
              <span>在</span>
              <strong>{{ selectedCluster || '未选择集群' }}</strong>
              <span>的租户资源配额</span>
            </div>
            <div v-loading="quotaLoading" class="form-grid quota-inline-grid">
              <el-form-item label="CPU Request（Cores）"
                ><el-input-number v-model="quotaModel.requestsCpu" :min="0" :precision="2" controls-position="right" /></el-form-item
              ><el-form-item label="CPU Limit（Cores）"
                ><el-input-number v-model="quotaModel.limitsCpu" :min="0" :precision="2" controls-position="right" /></el-form-item
              ><el-form-item label="内存 Request（GiB）"
                ><el-input-number v-model="quotaModel.requestsMemory" :min="0" :precision="2" controls-position="right" /></el-form-item
              ><el-form-item label="内存 Limit（GiB）"
                ><el-input-number v-model="quotaModel.limitsMemory" :min="0" :precision="2" controls-position="right" /></el-form-item
              ><el-form-item label="GPU Request（卡）"
                ><el-input-number v-model="quotaModel.requestsGpu" :min="0" :precision="0" controls-position="right" /></el-form-item
              ><el-form-item label="GPU Limit（卡）"
                ><el-input-number v-model="quotaModel.limitsGpu" :min="0" :precision="0" controls-position="right" /></el-form-item
              ><el-form-item label="存储 Request（GiB）"
                ><el-input-number v-model="quotaModel.requestsStorage" :min="0" :precision="2" controls-position="right"
              /></el-form-item>
            </div>
            <el-alert v-if="quotaError" :title="quotaError" type="error" :closable="false" show-icon />
            <div class="selection-actions">
              <el-button type="primary" :disabled="!selectedTenant || !selectedCluster" :loading="quotaSaving" @click="saveQuota"
                >保存租户配额</el-button
              ><el-button @click="openManagementPage">前往配额管理页</el-button>
            </div>
          </div>
          <EmptyState
            v-if="!tenants.length && !initializing"
            title="请先创建租户"
            description="配额必须归属于已有租户，可返回上一步创建。"
            action-text="返回创建租户"
            @action="goStep('tenant')"
          />
        </div>

        <div v-else-if="activeStep === 'project'" class="step-panel">
          <el-alert
            v-if="createdSteps.project"
            :title="`项目 ${createdProjectName} 已由本向导创建，可继续添加成员。`"
            type="success"
            :closable="false"
            show-icon
          />
          <el-form ref="projectFormRef" :model="projectModel" :rules="projectRules" label-position="top" class="create-form">
            <el-form-item label="所属租户" prop="tenant">
              <el-select v-model="projectModel.tenant" filterable placeholder="请选择租户" @change="onProjectTenantChange">
                <el-option
                  v-for="tenant in tenants"
                  :key="resourceName(tenant)"
                  :label="displayName(tenant)"
                  :value="resourceName(tenant)"
                />
              </el-select>
            </el-form-item>
            <div class="form-grid">
              <el-form-item label="项目名称" prop="displayName">
                <el-input v-model.trim="projectModel.displayName" maxlength="63" placeholder="例如：线上业务" />
              </el-form-item>
              <el-form-item label="项目标识" prop="name">
                <el-input v-model.trim="projectModel.name" maxlength="63" placeholder="例如：online-business" />
              </el-form-item>
            </div>
            <el-form-item label="项目描述" prop="description">
              <el-input
                v-model.trim="projectModel.description"
                type="textarea"
                :rows="3"
                maxlength="128"
                show-word-limit
                placeholder="说明项目承载的业务范围"
              />
            </el-form-item>
            <el-button type="primary" :disabled="!scope.controlCluster || !tenants.length" :loading="creatingProject" @click="createProject"
              >创建项目</el-button
            >
          </el-form>
          <EmptyState
            v-if="!tenants.length && !initializing"
            title="暂无可用租户"
            description="请先创建租户，再创建项目。"
            action-text="返回创建租户"
            @action="goStep('tenant')"
          />
        </div>

        <div v-else-if="activeStep === 'member'" class="step-panel">
          <el-alert
            title="成员授权会影响资源访问范围，请在成员管理页核对账号、角色和授权范围。向导不会因跳转而标记授权完成。"
            type="info"
            :closable="false"
            show-icon
          />
          <div class="selection-card">
            <el-form label-position="top">
              <div class="form-grid">
                <el-form-item label="所属租户">
                  <el-select v-model="selectedTenant" filterable placeholder="请选择租户" @change="onTenantChange">
                    <el-option
                      v-for="tenant in tenants"
                      :key="resourceName(tenant)"
                      :label="displayName(tenant)"
                      :value="resourceName(tenant)"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item label="关联项目">
                  <el-select v-model="selectedProject" filterable placeholder="请选择项目">
                    <el-option
                      v-for="project in projectsInTenant"
                      :key="resourceName(project)"
                      :label="displayName(project)"
                      :value="resourceName(project)"
                    />
                  </el-select>
                </el-form-item>
              </div>
            </el-form>
            <p class="text-secondary">下一步创建的空间将沿用这里选择的租户与项目。</p>
            <div class="form-grid member-inline-grid">
              <el-form-item label="账号"
                ><el-select v-model="memberModel.userName" filterable placeholder="选择用户"
                  ><el-option
                    v-for="user in memberUsers"
                    :key="user.metadata.name"
                    :label="`${user.spec?.displayName || user.metadata.name}（${user.metadata.name}）`"
                    :value="user.metadata.name" /></el-select
              ></el-form-item>
              <el-form-item label="角色"
                ><el-select v-model="memberModel.role" filterable placeholder="选择角色"
                  ><el-option
                    v-for="role in memberRoles"
                    :key="role.metadata.name"
                    :label="role.spec?.displayName || role.metadata.name"
                    :value="role.metadata.name" /></el-select
              ></el-form-item>
            </div>
            <el-alert v-if="memberError" :title="memberError" type="error" :closable="false" show-icon />
            <div class="selection-actions">
              <el-button
                type="primary"
                :disabled="!selectedTenant || !memberModel.userName || !memberModel.role"
                :loading="memberSaving"
                @click="addMember"
                >立即添加成员</el-button
              ><el-button :disabled="!selectedTenant || !selectedProject" @click="openManagementPage">前往成员管理页</el-button>
            </div>
          </div>
          <EmptyState
            v-if="!projects.length && !initializing"
            title="暂无可用项目"
            description="请先创建项目，再配置项目成员。"
            action-text="返回创建项目"
            @action="goStep('project')"
          />
        </div>

        <div v-else class="step-panel">
          <el-alert
            v-if="createdSpaceName"
            :title="`空间 ${createdSpaceName} 创建成功`"
            description="空间与 ResourceQuota 已由后端接受，可前往空间管理查看实际状态。"
            type="success"
            :closable="false"
            show-icon
          />
          <el-alert
            title="创建空间时会同时提交 ResourceQuota。可用配额、集群状态与名称唯一性均由后端最终校验。"
            type="info"
            :closable="false"
            show-icon
          />
          <el-form ref="spaceFormRef" :model="spaceModel" :rules="spaceRules" label-position="top" class="create-form">
            <div class="form-grid">
              <el-form-item label="所属租户" prop="tenant">
                <el-select v-model="spaceModel.tenant" filterable placeholder="请选择租户" @change="onSpaceTenantChange">
                  <el-option
                    v-for="tenant in tenants"
                    :key="resourceName(tenant)"
                    :label="displayName(tenant)"
                    :value="resourceName(tenant)"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="所属项目" prop="project">
                <el-select v-model="spaceModel.project" filterable placeholder="请选择项目">
                  <el-option
                    v-for="project in spaceProjects"
                    :key="resourceName(project)"
                    :label="displayName(project)"
                    :value="resourceName(project)"
                  />
                </el-select>
              </el-form-item>
            </div>
            <div class="form-grid">
              <el-form-item label="目标集群" prop="cluster">
                <el-select v-model="spaceModel.cluster" filterable placeholder="请选择成员集群">
                  <el-option
                    v-for="cluster in memberClusters"
                    :key="cluster.clusterName"
                    :label="cluster.clusterDisplayName || cluster.clusterName"
                    :value="cluster.clusterName"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="空间名称" prop="namespace">
                <el-input v-model.trim="spaceModel.namespace" maxlength="63" placeholder="例如：online-shop" />
              </el-form-item>
            </div>
            <div class="quota-grid">
              <el-form-item label="CPU 请求 / 上限（核）" prop="cpu">
                <el-input-number v-model="spaceModel.cpu" :min="0.1" :max="1024" :step="0.5" controls-position="right" />
              </el-form-item>
              <el-form-item label="内存请求 / 上限（GiB）" prop="memoryGi">
                <el-input-number v-model="spaceModel.memoryGi" :min="1" :max="4096" :step="1" controls-position="right" />
              </el-form-item>
              <el-form-item label="存储请求（GiB）" prop="storageGi">
                <el-input-number v-model="spaceModel.storageGi" :min="1" :max="10240" :step="5" controls-position="right" />
              </el-form-item>
            </div>
            <el-button type="primary" :disabled="!memberClusters.length" :loading="creatingSpace" @click="createSpace">创建空间</el-button>
          </el-form>
          <EmptyState
            v-if="!memberClusters.length && !initializing"
            title="暂无可用成员集群"
            description="请先确认成员集群已接入且状态正常，再创建空间。"
          />
        </div>

        <div class="wizard-footer">
          <el-button :disabled="activeIndex === 0" :icon="ArrowLeft" @click="previousStep">上一步</el-button>
          <span class="text-secondary">可随时切换步骤，未完成的配置不会被自动跳过。</span>
          <el-button v-if="activeIndex < steps.length - 1" type="primary" plain @click="nextStep">
            下一步<el-icon class="el-icon--right"><ArrowRight /></el-icon>
          </el-button>
          <el-button v-else type="primary" plain @click="openManagementPage">查看空间管理</el-button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter, type RouteLocationRaw } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { ArrowLeft, ArrowRight, Check, TopRight } from '@element-plus/icons-vue'
import { scopeApi } from '@/api/scope'
import { userApi } from '@/api/auth'
import { clusterApi, namespaceApi } from '@/api/cluster'
import { useScopeStore } from '@/stores/scope'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import type { KubeResource } from '@/types/api'

type StepKey = 'tenant' | 'quota' | 'project' | 'member' | 'space'
interface StepDefinition {
  key: StepKey
  title: string
  description: string
  longDescription: string
  linkText: string
}

const router = useRouter()
const scope = useScopeStore()
const steps: StepDefinition[] = [
  {
    key: 'tenant',
    title: '创建租户',
    description: '建立组织与资源边界',
    longDescription: '先建立一个基础租户，后续配额、项目和成员都将归属于它。',
    linkText: '租户管理',
  },
  {
    key: 'quota',
    title: '配置配额',
    description: '分配集群可用资源',
    longDescription: '为租户在目标集群中分配可用计算与存储资源。',
    linkText: '配额管理',
  },
  {
    key: 'project',
    title: '创建项目',
    description: '组织业务与研发团队',
    longDescription: '在租户下创建项目，用于隔离不同业务或团队的资源。',
    linkText: '项目管理',
  },
  {
    key: 'member',
    title: '添加成员',
    description: '授予合适的角色',
    longDescription: '确认项目成员及其角色，遵循最小权限原则。',
    linkText: '成员管理',
  },
  {
    key: 'space',
    title: '创建空间',
    description: '承载实际工作负载',
    longDescription: '在成员集群中创建带基础资源配额的空间，开始部署应用。',
    linkText: '空间管理',
  },
]
const activeStep = ref<StepKey>('tenant')
const activeIndex = computed(() => steps.findIndex((step) => step.key === activeStep.value))
const currentStep = computed(() => steps[activeIndex.value] || steps[0]!)
const createdSteps = reactive<Record<StepKey, boolean>>({ tenant: false, quota: false, project: false, member: false, space: false })

const initializing = ref(false)
const controlError = ref(false)
const dataError = ref(false)
const tenants = ref<KubeResource[]>([])
const projects = ref<KubeResource[]>([])
const selectedTenant = ref('')
const selectedProject = ref('')
const selectedCluster = ref('')
let resourceGeneration = 0

const tenantFormRef = ref<FormInstance>()
const projectFormRef = ref<FormInstance>()
const spaceFormRef = ref<FormInstance>()
const tenantModel = reactive({ name: '', displayName: '' })
const projectModel = reactive({ tenant: '', name: '', displayName: '', description: '' })
const spaceModel = reactive({ tenant: '', project: '', cluster: '', namespace: '', cpu: 1, memoryGi: 2, storageGi: 10 })
const quotaModel = reactive({
  requestsCpu: 0,
  limitsCpu: 0,
  requestsMemory: 0,
  limitsMemory: 0,
  requestsGpu: 0,
  limitsGpu: 0,
  requestsStorage: 0,
})
const quotaLoading = ref(false)
const quotaSaving = ref(false)
const quotaError = ref('')
const memberUsers = ref<KubeResource[]>([])
const memberRoles = ref<KubeResource[]>([])
const memberModel = reactive({ userName: '', role: '' })
const memberSaving = ref(false)
const memberError = ref('')
const creatingTenant = ref(false)
const creatingProject = ref(false)
const creatingSpace = ref(false)
const createdTenantName = ref('')
const createdProjectName = ref('')
const createdSpaceName = ref('')

const memberClusters = computed(() => scope.activeClusters.filter((cluster) => cluster.isMemberCluster))
const projectsInTenant = computed(() =>
  selectedTenant.value ? projects.value.filter((project) => projectTenant(project) === selectedTenant.value) : [],
)
const spaceProjects = computed(() =>
  spaceModel.tenant ? projects.value.filter((project) => projectTenant(project) === spaceModel.tenant) : [],
)

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function resourceName(resource: KubeResource): string {
  return resource.metadata?.name || String(record(resource).name || '')
}

function displayName(resource: KubeResource): string {
  return String(record(resource.spec).displayName || resourceName(resource))
}

function projectTenant(project: KubeResource): string {
  return String(record(project.metadata?.labels)['kubecube.io/tenant'] || record(project.spec).tenant || '')
}

function projectNamespace(project: KubeResource): string {
  return String(record(project.spec).namespace || `kubecube-project-${resourceName(project)}`)
}

function stepStatus(step: StepKey): string {
  if (createdSteps[step]) return '已由本向导创建'
  if (step === 'quota' || step === 'member') return '需在管理页配置'
  return '待创建'
}

const nameRule = {
  required: true,
  pattern: /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/,
  message: '请输入小写字母、数字或中划线，并以字母或数字开头和结尾',
  trigger: 'blur',
}
const scopeRules: FormRules = {
  displayName: [{ required: true, message: '请输入租户名称', trigger: 'blur' }],
  name: [nameRule],
}
const projectRules: FormRules = {
  tenant: [{ required: true, message: '请选择所属租户', trigger: 'change' }],
  displayName: [{ required: true, message: '请输入项目名称', trigger: 'blur' }],
  name: [nameRule],
}
const spaceRules: FormRules = {
  tenant: [{ required: true, message: '请选择所属租户', trigger: 'change' }],
  project: [{ required: true, message: '请选择所属项目', trigger: 'change' }],
  cluster: [{ required: true, message: '请选择目标集群', trigger: 'change' }],
  namespace: [nameRule],
  cpu: [{ required: true, type: 'number', min: 0.1, message: 'CPU 不得小于 0.1 核', trigger: 'change' }],
  memoryGi: [{ required: true, type: 'number', min: 1, message: '内存不得小于 1 GiB', trigger: 'change' }],
  storageGi: [{ required: true, type: 'number', min: 1, message: '存储不得小于 1 GiB', trigger: 'change' }],
}

async function initialize() {
  initializing.value = true
  controlError.value = false
  try {
    if (!scope.clusters.length) {
      const response = await clusterApi.list({ prune: true })
      scope.clusters = response.items || []
    }
    if (!scope.controlCluster) throw new Error('未找到管控集群')
    selectedCluster.value = selectedCluster.value || memberClusters.value[0]?.clusterName || ''
    spaceModel.cluster = spaceModel.cluster || selectedCluster.value
    await refreshResources()
  } catch {
    controlError.value = true
  } finally {
    initializing.value = false
  }
}

async function refreshResources() {
  if (!scope.controlCluster) return
  const generation = ++resourceGeneration
  dataError.value = false
  const results = await Promise.allSettled([
    scopeApi.list(scope.controlCluster, 'tenants', { pageNum: 1, pageSize: 100 }),
    scopeApi.list(scope.controlCluster, 'projects', { pageNum: 1, pageSize: 100 }),
  ])
  if (generation !== resourceGeneration) return
  const [tenantResult, projectResult] = results
  if (tenantResult?.status === 'fulfilled') {
    tenants.value = tenantResult.value.items || []
    if (!tenants.value.some((item) => resourceName(item) === selectedTenant.value))
      selectedTenant.value = resourceName(tenants.value[0] || ({ metadata: { name: '' } } as KubeResource))
    projectModel.tenant = projectModel.tenant || selectedTenant.value
    spaceModel.tenant = spaceModel.tenant || selectedTenant.value
  }
  if (projectResult?.status === 'fulfilled') {
    projects.value = projectResult.value.items || []
    if (!projectsInTenant.value.some((item) => resourceName(item) === selectedProject.value))
      selectedProject.value = resourceName(projectsInTenant.value[0] || ({ metadata: { name: '' } } as KubeResource))
    if (!spaceProjects.value.some((item) => resourceName(item) === spaceModel.project))
      spaceModel.project = resourceName(spaceProjects.value[0] || ({ metadata: { name: '' } } as KubeResource))
  }
  dataError.value = results.some((result) => result.status === 'rejected')
}

function goStep(step: StepKey) {
  activeStep.value = step
  if (step === 'project') projectModel.tenant = projectModel.tenant || selectedTenant.value
  if (step === 'space') syncSpaceDefaults()
}

function previousStep() {
  const previous = steps[activeIndex.value - 1]
  if (previous) goStep(previous.key)
}

function nextStep() {
  const next = steps[activeIndex.value + 1]
  if (next) goStep(next.key)
}

function onTenantChange() {
  selectedProject.value = resourceName(projectsInTenant.value[0] || ({ metadata: { name: '' } } as KubeResource))
  projectModel.tenant = selectedTenant.value
  spaceModel.tenant = selectedTenant.value
  spaceModel.project = selectedProject.value
}

function onProjectTenantChange() {
  selectedTenant.value = projectModel.tenant
  selectedProject.value = resourceName(projectsInTenant.value[0] || ({ metadata: { name: '' } } as KubeResource))
  spaceModel.tenant = projectModel.tenant
  spaceModel.project = selectedProject.value
}

function onSpaceTenantChange() {
  spaceModel.project = resourceName(spaceProjects.value[0] || ({ metadata: { name: '' } } as KubeResource))
  selectedTenant.value = spaceModel.tenant
  selectedProject.value = spaceModel.project
}

function syncSpaceCluster() {
  spaceModel.cluster = selectedCluster.value
}

function syncSpaceDefaults() {
  spaceModel.tenant = spaceModel.tenant || selectedTenant.value
  spaceModel.project = resourceName(spaceProjects.value[0] || ({ metadata: { name: '' } } as KubeResource)) || spaceModel.project
  spaceModel.cluster = spaceModel.cluster || selectedCluster.value || memberClusters.value[0]?.clusterName || ''
}

async function createTenant() {
  const valid = await tenantFormRef.value?.validate().catch(() => false)
  if (!valid || !scope.controlCluster) return
  creatingTenant.value = true
  try {
    await scopeApi.create(scope.controlCluster, 'tenants', {
      apiVersion: 'tenant.kubecube.io/v1',
      kind: 'Tenant',
      metadata: { name: tenantModel.name },
      spec: { displayName: tenantModel.displayName },
    })
    createdSteps.tenant = true
    createdTenantName.value = tenantModel.name
    selectedTenant.value = tenantModel.name
    projectModel.tenant = tenantModel.name
    spaceModel.tenant = tenantModel.name
    ElMessage.success('租户创建成功')
    Object.assign(tenantModel, { name: '', displayName: '' })
    await refreshResources()
  } catch {
    // 保留输入，接口未成功时不更新步骤状态。
  } finally {
    creatingTenant.value = false
  }
}

async function createProject() {
  const valid = await projectFormRef.value?.validate().catch(() => false)
  if (!valid || !scope.controlCluster) return
  creatingProject.value = true
  try {
    await scopeApi.create(scope.controlCluster, 'projects', {
      apiVersion: 'tenant.kubecube.io/v1',
      kind: 'Project',
      metadata: { name: projectModel.name, labels: { 'kubecube.io/tenant': projectModel.tenant } },
      spec: { displayName: projectModel.displayName, description: projectModel.description },
    })
    createdSteps.project = true
    createdProjectName.value = projectModel.name
    selectedTenant.value = projectModel.tenant
    selectedProject.value = projectModel.name
    spaceModel.tenant = projectModel.tenant
    spaceModel.project = projectModel.name
    ElMessage.success('项目创建成功')
    Object.assign(projectModel, { name: '', displayName: '', description: '', tenant: selectedTenant.value })
    await refreshResources()
  } catch {
    // 保留输入，接口未成功时不更新步骤状态。
  } finally {
    creatingProject.value = false
  }
}

async function createSpace() {
  const valid = await spaceFormRef.value?.validate().catch(() => false)
  if (!valid) return
  const project = projects.value.find((item) => resourceName(item) === spaceModel.project)
  if (!project) {
    ElMessage.warning('未找到所选项目，请刷新基础数据后重试')
    return
  }
  creatingSpace.value = true
  createdSpaceName.value = ''
  try {
    const { cluster, tenant, project: projectName, namespace } = spaceModel
    const quotaName = `${cluster}.${tenant}.${projectName}.${namespace}`
    const labels = {
      'kubecube.io/quota': `${cluster}.${tenant}`,
      'kubecube.io/cluster': cluster,
      'kubecube.io/tenant': tenant,
      'kubecube.io/project': projectName,
    }
    await namespaceApi.createQuota({
      cluster,
      space: {
        metadata: {
          name: namespace,
          namespace: projectNamespace(project),
          labels: { 'kubecube.io/tenant': tenant, 'kubecube.io/project': projectName },
        },
      },
      resourceQuota: {
        apiVersion: 'v1',
        kind: 'ResourceQuota',
        metadata: { name: quotaName, namespace, labels },
        spec: {
          hard: {
            'requests.cpu': String(spaceModel.cpu),
            'limits.cpu': String(spaceModel.cpu),
            'requests.memory': `${spaceModel.memoryGi}Gi`,
            'limits.memory': `${spaceModel.memoryGi}Gi`,
            'requests.storage': `${spaceModel.storageGi}Gi`,
          },
        },
      },
    })
    createdSteps.space = true
    createdSpaceName.value = namespace
    selectedTenant.value = tenant
    selectedProject.value = projectName
    selectedCluster.value = cluster
    ElMessage.success('空间创建成功')
    spaceModel.namespace = ''
  } catch {
    // 后端未接受请求时保留完整表单，不显示完成状态。
  } finally {
    creatingSpace.value = false
  }
}

function quantityNumber(value: unknown, memory = false) {
  const match = String(value ?? '')
    .trim()
    .match(/^(\d+\.?\d*|\.\d+)([a-zA-Z]*)$/)
  if (!match) return 0
  const number = Number(match[1])
  const unit = match[2] || ''
  if (!memory) return unit === 'm' ? number / 1000 : number
  const factors: Record<string, number> = { '': 1 / 1024 ** 3, Ki: 1 / 1024 ** 2, Mi: 1 / 1024, Gi: 1, Ti: 1024 }
  return number * (factors[unit] ?? 1)
}
async function loadTenantQuota() {
  if (!selectedTenant.value || !selectedCluster.value || !scope.controlCluster) return
  quotaLoading.value = true
  quotaError.value = ''
  try {
    const response = await scopeApi.quotas(scope.controlCluster)
    const name = `${selectedCluster.value}.${selectedTenant.value}`
    const quota = (response.items || []).find((item) => item.metadata.name === name)
    const hard = ((quota?.spec as Record<string, any> | undefined)?.hard || {}) as Record<string, unknown>
    Object.assign(quotaModel, {
      requestsCpu: quantityNumber(hard['requests.cpu']),
      limitsCpu: quantityNumber(hard['limits.cpu']),
      requestsMemory: quantityNumber(hard['requests.memory'], true),
      limitsMemory: quantityNumber(hard['limits.memory'], true),
      requestsGpu: quantityNumber(hard['requests.nvidia.com/gpu']),
      limitsGpu: quantityNumber(hard['limits.nvidia.com/gpu']),
      requestsStorage: quantityNumber(hard['requests.storage'], true),
    })
  } catch (error) {
    quotaError.value = `租户配额读取失败：${error instanceof Error ? error.message : '请求失败'}`
  } finally {
    quotaLoading.value = false
  }
}
async function saveQuota() {
  if (!selectedTenant.value || !selectedCluster.value || !scope.controlCluster) return
  quotaSaving.value = true
  quotaError.value = ''
  try {
    const value = (input: number) => (Number.isFinite(Number(input)) ? Number(input) : 0)
    const hard = {
      'requests.cpu': String(value(quotaModel.requestsCpu)),
      'limits.cpu': String(value(quotaModel.limitsCpu)),
      'requests.memory': `${value(quotaModel.requestsMemory)}Gi`,
      'limits.memory': `${value(quotaModel.limitsMemory)}Gi`,
      'requests.nvidia.com/gpu': String(value(quotaModel.requestsGpu)),
      'limits.nvidia.com/gpu': String(value(quotaModel.limitsGpu)),
      'requests.storage': `${value(quotaModel.requestsStorage)}Gi`,
    }
    const name = `${selectedCluster.value}.${selectedTenant.value}`
    const response = await scopeApi.quotas(scope.controlCluster)
    const existing = (response.items || []).find((item) => item.metadata.name === name)
    if (existing) await scopeApi.patchQuota(scope.controlCluster, name, { spec: { hard } })
    else
      await scopeApi.createQuota(scope.controlCluster, {
        apiVersion: 'quota.kubecube.io/v1',
        kind: 'CubeResourceQuota',
        metadata: {
          name,
          labels: { 'kubecube.io/cluster': selectedCluster.value, 'kubecube.io/tenant': selectedTenant.value },
          annotations: { 'kubecube.io/sync': 'true' },
        },
        spec: { hard, target: { name: selectedTenant.value, kind: 'Tenant' } },
      })
    createdSteps.quota = true
    ElMessage.success(`租户 ${selectedTenant.value} 在 ${selectedCluster.value} 的配额已保存`)
  } catch (error) {
    quotaError.value = `租户配额保存失败：${error instanceof Error ? error.message : '请求失败'}`
  } finally {
    quotaSaving.value = false
  }
}
watch([selectedTenant, selectedCluster, activeStep], () => {
  if (activeStep.value === 'quota') void loadTenantQuota()
})

async function loadMemberOptions() {
  if (!selectedTenant.value) return
  try {
    const [users, roles] = await Promise.all([
      userApi.list({ pageNum: 1, pageSize: 200 }),
      userApi.clusterRoles(selectedProject.value ? 'project' : 'tenant'),
    ])
    memberUsers.value = users.items || []
    memberRoles.value = roles.items || []
    memberModel.userName = memberUsers.value.some((user) => user.metadata.name === memberModel.userName)
      ? memberModel.userName
      : memberUsers.value[0]?.metadata.name || ''
    memberModel.role = memberRoles.value.some((role) => role.metadata.name === memberModel.role)
      ? memberModel.role
      : memberRoles.value[0]?.metadata.name || ''
  } catch {
    memberError.value = '用户或角色列表加载失败，请稍后重试。'
  }
}
async function addMember() {
  const tenant = tenants.value.find((item) => resourceName(item) === selectedTenant.value)
  if (!tenant || !memberModel.userName || !memberModel.role) return
  const project = projects.value.find((item) => resourceName(item) === selectedProject.value)
  const tenantNamespace = String(record(tenant.spec).namespace || `kubecube-tenant-${selectedTenant.value}`)
  const namespace = project ? projectNamespace(project) : tenantNamespace
  memberSaving.value = true
  memberError.value = ''
  try {
    const labels: Record<string, string> = { 'kubecube.io/rbac': 'true', 'kubecube.io/tenant': selectedTenant.value }
    if (project) labels['kubecube.io/project'] = selectedProject.value
    await userApi.createBinding({
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
    })
    createdSteps.member = true
    ElMessage.success(`已将 ${memberModel.userName} 添加为${project ? '项目' : '租户'}成员`)
  } catch (error) {
    memberError.value = `成员添加失败：${error instanceof Error ? error.message : '请求失败'}`
  } finally {
    memberSaving.value = false
  }
}
watch([selectedTenant, selectedProject, activeStep], () => {
  if (activeStep.value === 'member') void loadMemberOptions()
})

function openManagementPage() {
  let target: RouteLocationRaw
  switch (activeStep.value) {
    case 'tenant':
      target = { path: '/platform/tenant/tenant', query: { tenant: selectedTenant.value || undefined } }
      break
    case 'quota':
      target = {
        path: '/platform/quota',
        query: { tenant: selectedTenant.value || undefined, cluster: selectedCluster.value || undefined },
      }
      break
    case 'project':
      target = { path: '/platform/tenant/project', query: { tenant: selectedTenant.value || undefined } }
      break
    case 'member':
      target = {
        path: '/platform/tenant/member',
        query: { tenant: selectedTenant.value || undefined, project: selectedProject.value || undefined },
      }
      break
    case 'space':
      target = {
        path: '/platform/nsquota',
        query: {
          tenant: spaceModel.tenant || undefined,
          project: spaceModel.project || undefined,
          cluster: spaceModel.cluster || undefined,
        },
      }
      break
  }
  void router.push(target)
}

onMounted(initialize)
</script>

<style scoped>
.wizard-layout {
  display: grid;
  grid-template-columns: 270px minmax(0, 1fr);
  min-height: 680px;
  overflow: hidden;
}
.step-nav {
  display: flex;
  padding: 26px 16px;
  background: var(--surface-subtle);
  border-right: 1px solid var(--border-light);
  flex-direction: column;
  gap: 8px;
}
.step-button {
  position: relative;
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 12px;
  color: var(--text-regular);
  text-align: left;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 12px;
  cursor: pointer;
}
.step-button:hover {
  background: #fff;
}
.step-button--active {
  background: #fff;
  border-color: var(--brand-200);
  box-shadow: var(--shadow-xs);
}
.step-number {
  display: grid;
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
  color: var(--text-secondary);
  background: #fff;
  border: 1px solid var(--border-regular);
  border-radius: 50%;
  place-items: center;
  font-size: 13px;
  font-weight: 600;
}
.step-button--active .step-number {
  color: #fff;
  background: var(--brand-500);
  border-color: var(--brand-500);
}
.step-button--created .step-number {
  color: #fff;
  background: var(--success);
  border-color: var(--success);
}
.step-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
}
.step-copy strong {
  font-size: 14px;
}
.step-copy small {
  margin-top: 3px;
  color: var(--text-secondary);
  font-size: 12px;
}
.step-copy em {
  margin-top: 7px;
  color: var(--text-tertiary);
  font-size: 11px;
  font-style: normal;
}
.step-button--created .step-copy em {
  color: #067647;
}
.wizard-content {
  display: flex;
  min-width: 0;
  padding: 30px 34px 24px;
  flex-direction: column;
}
.wizard-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--border-light);
}
.step-eyebrow {
  display: block;
  margin-bottom: 6px;
  color: var(--brand-600);
  font-size: 12px;
  font-weight: 600;
}
.wizard-heading h2 {
  font-size: 22px;
}
.wizard-heading p {
  max-width: 620px;
  margin-top: 7px;
  color: var(--text-secondary);
  line-height: 22px;
}
.step-panel {
  display: flex;
  max-width: 820px;
  padding: 24px 0;
  flex: 1;
  flex-direction: column;
  gap: 20px;
}
.create-form {
  max-width: 680px;
}
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}
.quota-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}
.quota-grid .el-input-number {
  width: 100%;
}
.form-help {
  margin-top: 5px;
  color: var(--text-tertiary);
  font-size: 12px;
}
.selection-card {
  display: flex;
  max-width: 680px;
  padding: 22px;
  background: var(--surface-subtle);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  flex-direction: column;
  gap: 16px;
}
.selection-card .el-button {
  align-self: flex-start;
}
.selection-summary {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
  color: var(--text-secondary);
  font-size: 13px;
}
.selection-summary strong {
  color: var(--text-primary);
}
.quota-inline-grid {
  margin-top: 18px;
}
.member-inline-grid {
  margin-top: 14px;
}
.selection-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 16px;
}
.wizard-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: auto;
  padding-top: 20px;
  border-top: 1px solid var(--border-light);
}
.wizard-footer > span {
  font-size: 12px;
  text-align: center;
}
.el-select {
  width: 100%;
}
@media (max-width: 1100px) {
  .wizard-layout {
    grid-template-columns: 230px minmax(0, 1fr);
  }
  .wizard-content {
    padding: 26px 24px 22px;
  }
  .quota-grid {
    grid-template-columns: 1fr;
    gap: 0;
  }
}
@media (max-width: 768px) {
  .wizard-layout {
    display: block;
  }
  .step-nav {
    padding: 12px;
    overflow-x: auto;
    border-right: 0;
    border-bottom: 1px solid var(--border-light);
    flex-direction: row;
  }
  .step-button {
    min-width: 180px;
  }
  .wizard-content {
    padding: 22px 16px;
  }
  .wizard-heading {
    flex-direction: column;
    gap: 16px;
  }
  .form-grid {
    grid-template-columns: 1fr;
    gap: 0;
  }
  .wizard-footer {
    align-items: stretch;
    flex-wrap: wrap;
  }
  .wizard-footer > span {
    width: 100%;
    order: -1;
  }
}
</style>
