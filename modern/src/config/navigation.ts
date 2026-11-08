import type { ManagerRole } from '@/types/api'

export interface NavItem {
  label: string
  path?: string
  icon: string
  action?: 'yaml' | 'shell'
  children?: Array<{ label: string; path: string }>
}

export const controlNavigation: NavItem[] = [
  { label: '资源监控', path: '/control/dashboard', icon: 'DataAnalysis' },
  {
    label: '工作负载',
    icon: 'Box',
    children: [
      { label: 'Deployments', path: '/control/deployments/list' },
      { label: 'StatefulSets', path: '/control/statefulsets/list' },
      { label: 'DaemonSets', path: '/control/daemonsets/list' },
      { label: 'CronJobs', path: '/control/cronjobs/list' },
      { label: 'Jobs', path: '/control/jobs/list' },
      { label: 'Pods', path: '/control/pods/list' },
    ],
  },
  {
    label: '服务与发现',
    icon: 'Connection',
    children: [
      { label: 'Services', path: '/control/services/list' },
      { label: 'Ingresses', path: '/control/ingresses/list' },
    ],
  },
  { label: '存储声明', path: '/control/persistentvolumeclaims/list', icon: 'Coin' },
  {
    label: '配置中心',
    icon: 'Document',
    children: [
      { label: 'ConfigMaps', path: '/control/configmaps/list' },
      { label: 'Secrets', path: '/control/secrets/list' },
    ],
  },
  { label: 'YAML 编排', icon: 'EditPen', action: 'yaml' },
  { label: '自定义资源', path: '/control/crd/Cluster', icon: 'Files' },
  { label: 'Cloud Shell', icon: 'Monitor', action: 'shell' },
  {
    label: '日志中心',
    icon: 'Tickets',
    children: [
      { label: '日志任务', path: '/control/logconfigs/list' },
      { label: '日志查询', path: '/control/lens/normal' },
    ],
  },
  {
    label: '告警管理',
    icon: 'Bell',
    children: [
      { label: '告警规则', path: '/control/PrometheusRule/list' },
      { label: '告警策略组', path: '/control/AlertmanagerConfig/list' },
    ],
  },
  { label: '常用工具', path: '/control/bootstrap', icon: 'SetUp' },
]

export const platformNavigation: NavItem[] = [
  {
    label: '组织管理',
    icon: 'User',
    children: [
      { label: '用户管理', path: '/platform/user/list' },
      { label: '角色管理', path: '/platform/role/platform' },
      { label: '租户与项目', path: '/platform/tenant/tenant' },
      { label: '成员管理', path: '/platform/tenant/member' },
      { label: '快速向导', path: '/platform/bootstrap' },
    ],
  },
  {
    label: '资源管理',
    icon: 'Grid',
    children: [
      { label: '集群管理', path: '/platform/cluster/list' },
      { label: '空间管理', path: '/platform/nsquota' },
      { label: '租户配额', path: '/platform/quota' },
    ],
  },
  { label: '操作审计', path: '/platform/audit', icon: 'DocumentChecked' },
  { label: '组件监控', path: '/platform/monitor/list', icon: 'Odometer' },
  {
    label: '告警管理',
    icon: 'Bell',
    children: [
      { label: '全局告警规则', path: '/platform/PrometheusRule/list' },
      { label: '全局告警配置', path: '/platform/AlertmanagerConfig' },
    ],
  },
]

// Kept for consumers that need the role vocabulary beside the navigation; the
// page policy table remains the only authorization source.
export type NavigationRole = ManagerRole
