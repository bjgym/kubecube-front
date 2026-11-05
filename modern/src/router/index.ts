import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { useFeatureStore } from '@/stores/feature'
import { useScopeStore } from '@/stores/scope'
import { hasAnyRole } from '@/config/access'
import { getResourceConfig } from '@/config/resources'
import { splitInternalLocation } from '@/utils/last-location'

const routes: RouteRecordRaw[] = [
  { path: '/login', name: 'login', component: () => import('@/views/auth/LoginView.vue'), meta: { public: true, title: '登录' } },
  {
    path: '/noauth',
    name: 'noauth',
    component: () => import('@/views/error/ForbiddenView.vue'),
    meta: { public: true, title: '无访问权限' },
  },
  {
    path: '/',
    component: AppLayout,
    redirect: '/namespace',
    children: [
      { path: 'namespace', name: 'namespace', component: () => import('@/views/namespace/NamespaceView.vue'), meta: { title: '我的空间' } },
      {
        path: 'metauser',
        redirect: '/metauser/openapi',
        children: [
          {
            path: 'openapi',
            name: 'metauser.openapi',
            component: () => import('@/views/user/OpenApiView.vue'),
            meta: { title: '密钥管理' },
          },
        ],
      },
      {
        path: 'control',
        redirect: '/control/dashboard',
        children: [
          {
            path: 'dashboard',
            name: 'control.dashboard',
            component: () => import('@/views/control/DashboardView.vue'),
            meta: { title: '资源监控', feature: 'kubecube-monitoring' },
          },
          {
            path: 'bootstrap',
            name: 'control.bootstrap',
            component: () => import('@/views/control/ToolsView.vue'),
            meta: { title: '常用工具' },
          },
          {
            path: 'lens/:type',
            name: 'control.lens',
            component: () => import('@/views/control/LogSearchView.vue'),
            meta: { title: '日志查询', feature: 'logseer' },
          },
          { path: 'crd', redirect: '/control/crd/Cluster' },
          {
            path: 'crd/:level',
            name: 'crd.list',
            component: () => import('@/views/control/CrdListView.vue'),
            meta: { title: '自定义资源' },
          },
          {
            path: 'crd/:level/:name/:version',
            name: 'crd.detail',
            component: () => import('@/views/control/CrdDetailView.vue'),
            meta: { title: '自定义资源详情' },
          },
          { path: ':workload', redirect: (to) => `/control/${to.params.workload}/list` },
          {
            path: ':workload/list',
            name: 'control.workload.list',
            component: () => import('@/views/control/ResourceListView.vue'),
            meta: { title: '资源列表' },
          },
          {
            path: ':workload/create',
            name: 'control.workload.create',
            component: () => import('@/views/control/ResourceEditorView.vue'),
            meta: { title: '创建资源' },
          },
          { path: ':workload/:instance', redirect: (to) => `/control/${to.params.workload}/${to.params.instance}/info` },
          {
            path: ':workload/:instance/edit',
            name: 'control.workload.edit',
            component: () => import('@/views/control/ResourceEditorView.vue'),
            meta: { title: '编辑资源' },
          },
          {
            path: ':workload/:instance/updateImage',
            name: 'control.workload.updateImage',
            component: () => import('@/views/control/ResourceEditorView.vue'),
            meta: { title: '滚动更新' },
          },
          {
            path: ':workload/:instance/:tab(info|pod|monitor|jobs|event|condition|log|extrnal)',
            name: 'control.workload.info',
            component: () => import('@/views/control/ResourceDetailView.vue'),
            meta: { title: '资源详情' },
          },
          {
            path: ':workload/:instance/:pod/:container',
            name: 'control.workload.containerdetail',
            component: () => import('@/views/control/ContainerDetailView.vue'),
            meta: { title: '容器详情' },
          },
        ],
      },
      {
        path: 'platform',
        meta: { requiresManager: true },
        children: [
          {
            path: '',
            name: 'platform.home',
            component: () => import('@/views/platform/PlatformHomeView.vue'),
            meta: { title: '运维管理', requiresManager: true },
          },
          { path: 'user', redirect: '/platform/user/list' },
          {
            path: 'user/list',
            name: 'platform.user',
            component: () => import('@/views/platform/UserListView.vue'),
            meta: { title: '用户管理', requiresManager: true, requiresRoles: ['platformAdmin'] },
          },
          { path: 'role', redirect: '/platform/role/platform' },
          {
            path: 'role/:identity',
            name: 'platform.role.manage',
            component: () => import('@/views/platform/RoleListView.vue'),
            meta: { title: '角色管理', requiresManager: true },
          },
          { path: 'tenant', redirect: '/platform/tenant/tenant' },
          {
            path: 'tenant/:tab(tenant|project|member)',
            name: 'platform.tenant',
            component: () => import('@/views/platform/TenantManagementView.vue'),
            meta: { title: '租户与项目', requiresManager: true },
          },
          {
            path: 'bootstrap',
            name: 'platform.bootstrap',
            component: () => import('@/views/platform/QuickStartView.vue'),
            meta: { title: '快速向导', requiresManager: true },
          },
          {
            path: 'quota',
            name: 'platform.quota',
            component: () => import('@/views/platform/QuotaView.vue'),
            meta: { title: '租户配额', requiresManager: true, requiresRoles: ['platformAdmin'] },
          },
          {
            path: 'nsquota',
            name: 'platform.nsquota',
            component: () => import('@/views/platform/NamespaceManageView.vue'),
            meta: { title: '空间管理', requiresManager: true },
          },
          {
            path: 'audit',
            name: 'platform.audit',
            component: () => import('@/views/platform/AuditView.vue'),
            meta: { title: '操作审计', requiresManager: true, requiresRoles: ['platformAdmin'], feature: 'audit' },
          },
          { path: 'cluster', redirect: '/platform/cluster/list' },
          {
            path: 'cluster/list',
            name: 'platform.cluster.list',
            component: () => import('@/views/platform/ClusterListView.vue'),
            meta: { title: '集群管理', requiresManager: true },
          },
          { path: 'cluster/:name', redirect: (to) => `/platform/cluster/${to.params.name}/info` },
          {
            path: 'cluster/:name/:tab(info|node|storageclass|persistentvolumes|network|monitor)',
            name: 'platform.cluster.detail',
            component: () => import('@/views/platform/ClusterDetailView.vue'),
            meta: { title: '集群详情', requiresManager: true },
          },
          {
            path: 'cluster/:name/network/create',
            name: 'platform.cluster.detail.network.create',
            component: () => import('@/views/control/ResourceEditorView.vue'),
            meta: { title: '创建网络策略', requiresManager: true },
          },
          {
            path: 'cluster/:name/network/edit/:namespace/:instance',
            name: 'platform.cluster.detail.network.edit',
            component: () => import('@/views/control/ResourceEditorView.vue'),
            meta: { title: '编辑网络策略', requiresManager: true },
          },
          {
            path: 'cluster/:name/:nodename/:tab(info|pod|monitor|event)',
            name: 'platform.cluster.nodedetail',
            component: () => import('@/views/platform/NodeDetailView.vue'),
            meta: { title: '节点详情', requiresManager: true },
          },
          { path: 'monitor', redirect: '/platform/monitor/list' },
          {
            path: 'monitor/list',
            name: 'platform.monitor.list',
            component: () => import('@/views/platform/ComponentMonitorView.vue'),
            meta: { title: '组件监控', requiresManager: true, feature: 'kubecube-monitoring' },
          },
          {
            path: 'monitor/:dashboard',
            name: 'platform.monitor.dashboard',
            component: () => import('@/views/control/DashboardView.vue'),
            meta: { title: '组件监控', requiresManager: true, feature: 'kubecube-monitoring' },
          },
          { path: 'PrometheusRule', redirect: '/platform/PrometheusRule/list' },
          {
            path: 'PrometheusRule/list',
            name: 'platform.PrometheusRule.list',
            component: () => import('@/views/platform/GlobalAlertRulesView.vue'),
            meta: { title: '全局告警规则', requiresManager: true, requiresRoles: ['platformAdmin'], feature: 'kubecube-monitoring' },
          },
          {
            path: 'PrometheusRule/:cluster/create',
            name: 'platform.PrometheusRule.create',
            component: () => import('@/views/platform/AlertRuleEditorView.vue'),
            meta: { title: '创建告警规则', requiresManager: true, requiresRoles: ['platformAdmin'], feature: 'kubecube-monitoring' },
          },
          {
            path: 'PrometheusRule/:cluster/:instance/edit',
            name: 'platform.PrometheusRule.edit',
            component: () => import('@/views/platform/AlertRuleEditorView.vue'),
            meta: { title: '编辑告警规则', requiresManager: true, requiresRoles: ['platformAdmin'], feature: 'kubecube-monitoring' },
          },
          {
            path: 'AlertmanagerConfig',
            name: 'platform.AlertmanagerConfig',
            component: () => import('@/views/platform/GlobalAlertConfigView.vue'),
            meta: { title: '全局告警配置', requiresManager: true, requiresRoles: ['platformAdmin'], feature: 'kubecube-monitoring' },
          },
        ],
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/error/NotFoundView.vue'),
    meta: { public: true, title: '页面不存在' },
  },
]

const router = createRouter({ history: createWebHashHistory(import.meta.env.BASE_URL), routes, scrollBehavior: () => ({ top: 0 }) })

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (to.meta.public) {
    if (to.name === 'login' && auth.isAuthenticated) return '/'
    return true
  }
  if (!auth.isAuthenticated) {
    storageLikeSaveLastLocation(to.fullPath)
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  try {
    await auth.initialize()
    const features = useFeatureStore()
    if (!features.loaded) await features.load()
  } catch {
    storageLikeSaveLastLocation(to.fullPath)
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.meta.requiresManager && !auth.canManage) return { name: 'noauth' }
  if (to.meta.requiresRoles && !hasAnyRole(auth.identities, to.meta.requiresRoles)) return { name: 'noauth' }
  if (to.meta.feature && !useFeatureStore().features[to.meta.feature]) return { name: 'noauth' }
  const workload = typeof to.params.workload === 'string' ? to.params.workload : ''
  if (workload && !getResourceConfig(workload)) return { name: 'not-found' }
  return true
})

router.afterEach((to) => {
  const config = typeof to.params.workload === 'string' ? getResourceConfig(to.params.workload) : undefined
  const title = config ? `${config.title} · ${String(to.meta.title || '')}` : String(to.meta.title || '云原生管理平台')
  document.title = `${title} · ${import.meta.env.VITE_BRAND_NAME || 'KubeCube'}`
})

function storageLikeSaveLastLocation(fullPath: string) {
  try {
    localStorage.setItem('lastlocation', JSON.stringify(splitInternalLocation(fullPath)))
  } catch {
    /* unavailable storage */
  }
}

window.addEventListener('kubecube:unauthorized', () => {
  const auth = useAuthStore()
  auth.logout()
  useScopeStore().reset()
  if (router.currentRoute.value.name !== 'login') router.replace({ name: 'login' })
})

export default router
