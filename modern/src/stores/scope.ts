import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { clusterApi, namespaceApi } from '@/api/cluster'
import { userApi } from '@/api/auth'
import { useAuthStore } from './auth'
import type { ClusterInfo, KubeResource, NamespaceInfo } from '@/types/api'

export interface ScopeQuery {
  tenant?: string
  project?: string
  cluster?: string
  namespace?: string
  [key: string]: string | undefined
}

const scopeKeys = ['tenant', 'project', 'cluster', 'namespace'] as const
const resourcePermissions = [
  'dashboards',
  'deployments',
  'statefulsets',
  'daemonsets',
  'cronjobs',
  'jobs',
  'pods',
  'services',
  'ingresses',
  'persistentvolumeclaims',
  'secrets',
  'configmaps',
  'poddisruptionbudgets',
  'customresourcedefinitions',
]

export const useScopeStore = defineStore('scope', () => {
  const tenant = ref('')
  const project = ref('')
  const cluster = ref('')
  const namespace = ref('')
  const tenants = ref<KubeResource[]>([])
  const projects = ref<KubeResource[]>([])
  const clusters = ref<ClusterInfo[]>([])
  const namespaces = ref<NamespaceInfo[]>([])
  const permissions = ref<Record<string, boolean>>({})
  const loading = ref(false)
  const initialized = ref(false)
  let generation = 0
  let applying: Promise<void> | null = null

  const controlClusters = computed(() => clusters.value.filter((item) => !item.isMemberCluster))
  const controlCluster = computed(() => controlClusters.value[0]?.clusterName || '')
  const activeClusters = computed(() => clusters.value.filter((item) => item.status === 'normal' || !item.status))
  const query = computed<ScopeQuery>(() => ({
    tenant: tenant.value || undefined,
    project: project.value || undefined,
    cluster: cluster.value || undefined,
    namespace: namespace.value || undefined,
  }))
  const key = computed(() => [tenant.value, project.value, cluster.value, namespace.value].join('/'))
  const currentTenant = computed(() => tenants.value.find((item) => item.metadata.name === tenant.value))
  const currentProject = computed(() => projects.value.find((item) => item.metadata.name === project.value))
  const currentCluster = computed(() => clusters.value.find((item) => item.clusterName === cluster.value))

  const choose = <T>(items: T[], requested: string | undefined, getValue: (item: T) => string) =>
    items.find((item) => getValue(item) === requested) || items[0]

  async function loadTenants(requested?: string) {
    const auth = useAuthStore()
    if (!auth.user) return
    const response = await userApi.tenants(auth.user.AccountId)
    tenants.value = response.items || []
    tenant.value = choose(tenants.value, requested || tenant.value, (item) => item.metadata.name)?.metadata.name || ''
  }

  async function loadProjects(requested?: string) {
    const auth = useAuthStore()
    if (!auth.user || !tenant.value) {
      projects.value = []
      project.value = ''
      return
    }
    const response = await userApi.projects(auth.user.AccountId, tenant.value)
    projects.value = response.items || []
    project.value = choose(projects.value, requested || project.value, (item) => item.metadata.name)?.metadata.name || ''
  }

  async function loadClusters(requested?: string) {
    const response = await clusterApi.list({ prune: true })
    clusters.value = response.items || []
    const selectable = activeClusters.value
    cluster.value = choose(selectable, requested || cluster.value, (item) => item.clusterName)?.clusterName || ''
  }

  async function loadNamespaces(requested?: string) {
    if (!cluster.value) {
      namespaces.value = []
      namespace.value = ''
      return
    }
    const selectors = ['kubecube.io/tenant=' + tenant.value, 'kubecube.io/project=' + project.value].filter((item) => !item.endsWith('='))
    try {
      const response = await namespaceApi.list(cluster.value, { labelSelector: selectors.join(',') })
      namespaces.value = (response.items || []).map((item) => ({ ...item, cluster: cluster.value }))
      namespace.value = choose(namespaces.value, requested || namespace.value, (item) => item.metadata.name)?.metadata.name || ''
    } catch {
      namespaces.value = []
      namespace.value = ''
    }
  }

  async function loadPermissions() {
    if (!cluster.value || !namespace.value) {
      permissions.value = {}
      return
    }
    try {
      permissions.value = await userApi.permissions({
        cluster: cluster.value,
        infos: resourcePermissions.map((resource) => ({ resource, operator: 'write', namespace: namespace.value })),
      })
    } catch {
      permissions.value = {}
    }
  }

  async function initialize(routeQuery: ScopeQuery = {}) {
    const current = ++generation
    loading.value = true
    try {
      // Cluster discovery and tenant discovery are independent; project and
      // namespace discovery depend on them.
      await Promise.all([loadClusters(routeQuery.cluster), loadTenants(routeQuery.tenant)])
      await loadProjects(routeQuery.project)
      await loadNamespaces(routeQuery.namespace)
      if (!namespaces.value.length && !routeQuery.cluster) {
        for (const candidate of activeClusters.value) {
          if (candidate.clusterName === cluster.value) continue
          cluster.value = candidate.clusterName
          await loadNamespaces(routeQuery.namespace)
          if (namespaces.value.length) break
        }
      }
      await loadPermissions()
      if (current === generation) initialized.value = true
    } finally {
      if (current === generation) loading.value = false
    }
  }

  async function applyRouteScope(requested: ScopeQuery = {}) {
    if (applying) await applying.catch(() => undefined)
    if (initialized.value && scopeKeys.every((key) => !requested[key] || requested[key] === scopeValue(key))) return
    const run = initialize(requested)
    applying = run
    try {
      await run
    } finally {
      if (applying === run) applying = null
    }
  }

  function scopeValue(key: (typeof scopeKeys)[number]): string {
    return { tenant: tenant.value, project: project.value, cluster: cluster.value, namespace: namespace.value }[key]
  }
  async function selectTenant(value: string) {
    tenant.value = value
    project.value = ''
    namespace.value = ''
    await loadProjects()
    await loadNamespaces()
    await loadPermissions()
  }
  async function selectProject(value: string) {
    project.value = value
    namespace.value = ''
    await loadNamespaces()
    await loadPermissions()
  }
  async function selectCluster(value: string) {
    cluster.value = value
    namespace.value = ''
    await loadNamespaces()
    await loadPermissions()
  }
  async function selectNamespace(value: string) {
    namespace.value = value
    await loadPermissions()
  }
  function canWrite(resource: string) {
    return permissions.value[resource] === true
  }
  function reset() {
    generation++
    tenant.value = ''
    project.value = ''
    cluster.value = ''
    namespace.value = ''
    tenants.value = []
    projects.value = []
    clusters.value = []
    namespaces.value = []
    permissions.value = {}
    initialized.value = false
  }

  return {
    tenant,
    project,
    cluster,
    namespace,
    tenants,
    projects,
    clusters,
    namespaces,
    permissions,
    loading,
    initialized,
    controlClusters,
    controlCluster,
    activeClusters,
    query,
    key,
    currentTenant,
    currentProject,
    currentCluster,
    initialize,
    applyRouteScope,
    loadNamespaces,
    loadPermissions,
    selectTenant,
    selectProject,
    selectCluster,
    selectNamespace,
    canWrite,
    reset,
  }
})
