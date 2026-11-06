import type { ClusterInfo, KubeResource } from '@/types/api'

const created = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3_600_000).toISOString()

export const clusters: ClusterInfo[] = [
  {
    clusterName: 'pivot-cluster',
    clusterDisplayName: '管控集群',
    clusterDescription: '平台管控与租户资源',
    isMemberCluster: false,
    usedCpu: 18.6,
    totalCpu: 64,
    usedMem: 42_100,
    totalMem: 131_072,
    nodeCount: 3,
    namespaceCount: 12,
    status: 'normal',
    annotations: { 'cluster.kubecube.io/cn-name': '管控集群' },
  },
  {
    clusterName: 'production-shanghai',
    clusterDisplayName: '生产集群 · 上海',
    clusterDescription: '核心生产业务',
    isMemberCluster: true,
    usedCpu: 86.4,
    totalCpu: 128,
    usedMem: 198_000,
    totalMem: 262_144,
    nodeCount: 8,
    namespaceCount: 26,
    status: 'normal',
    annotations: { 'cluster.kubecube.io/cn-name': '生产集群 · 上海' },
  },
  {
    clusterName: 'staging-hangzhou',
    clusterDisplayName: '预发集群 · 杭州',
    clusterDescription: '预发布与集成测试',
    isMemberCluster: true,
    usedCpu: 12.2,
    totalCpu: 48,
    usedMem: 28_000,
    totalMem: 98_304,
    nodeCount: 3,
    namespaceCount: 9,
    status: 'normal',
    annotations: { 'cluster.kubecube.io/cn-name': '预发集群 · 杭州' },
  },
]

const metadata = (name: string, namespace = 'online-shop', hoursAgo = 72) => ({
  name,
  namespace,
  uid: crypto.randomUUID(),
  creationTimestamp: created(hoursAgo),
  labels: { 'app.kubernetes.io/name': name, 'kubecube.io/tenant': 'digital-retail', 'kubecube.io/project': 'online-business' },
  annotations: {},
  resourceVersion: '128639',
})

const containers = [
  {
    name: 'app',
    image: 'registry.example.com/shop/web:v2.8.1',
    resources: { requests: { cpu: '250m', memory: '256Mi' }, limits: { cpu: '1', memory: '1Gi' } },
  },
]

const workload = (kind: string, name: string, replicas: number, available = replicas): KubeResource => ({
  apiVersion: 'apps/v1',
  kind,
  metadata: { ...metadata(name), ...(kind === 'Deployment' ? { uid: `deployment-${name}` } : {}) },
  spec: { replicas, selector: { matchLabels: { app: name } }, template: { metadata: { labels: { app: name } }, spec: { containers } } },
  status: { replicas, readyReplicas: available, availableReplicas: available, updatedReplicas: replicas, observedGeneration: 12 },
})

export const resources: Record<string, KubeResource[]> = {
  resourcequotas: [
    {
      apiVersion: 'v1',
      kind: 'ResourceQuota',
      cluster: 'production-shanghai',
      metadata: {
        ...metadata('production-shanghai.digital-retail.online-business.online-shop', 'online-shop', 24 * 80),
        labels: {
          'kubecube.io/quota': 'production-shanghai.digital-retail',
          'kubecube.io/cluster': 'production-shanghai',
          'kubecube.io/tenant': 'digital-retail',
          'kubecube.io/project': 'online-business',
        },
      },
      spec: {
        hard: { 'requests.cpu': '8', 'limits.cpu': '16', 'requests.memory': '16Gi', 'limits.memory': '32Gi', 'requests.storage': '100Gi' },
      },
      status: {
        used: { 'requests.cpu': '3.5', 'limits.cpu': '6', 'requests.memory': '7Gi', 'limits.memory': '12Gi', 'requests.storage': '40Gi' },
      },
    },
  ],
  nodes: [1, 2, 3].map((index) => ({
    apiVersion: 'v1',
    kind: 'Node',
    metadata: {
      ...metadata(`worker-${index}`, '', 24 * 120),
      labels: {
        'kubernetes.io/hostname': `worker-${index}`,
        'node-role.kubernetes.io/worker': '',
        'node.kubernetes.io/instance-type': index === 1 ? 'gpu.a10' : 'c6.2xlarge',
        ...(index === 1 ? { 'nvidia.com/gpu.product': 'NVIDIA A10' } : {}),
      },
    },
    spec: { podCIDR: `10.244.${index}.0/24`, unschedulable: false },
    status: {
      capacity: { cpu: '16', memory: '64Gi', pods: '110', ...(index === 1 ? { 'nvidia.com/gpu': '1' } : {}) },
      allocatable: { cpu: '15', memory: '62Gi', pods: '110', ...(index === 1 ? { 'nvidia.com/gpu': '1' } : {}) },
      addresses: [
        { type: 'InternalIP', address: `192.168.10.${10 + index}` },
        { type: 'Hostname', address: `worker-${index}` },
      ],
      conditions: [
        {
          type: 'Ready',
          status: 'True',
          reason: 'KubeletReady',
          message: 'kubelet is posting ready status',
          lastTransitionTime: created(2),
        },
      ],
      nodeInfo: { kubeletVersion: 'v1.33.5', osImage: 'Ubuntu 24.04 LTS', containerRuntimeVersion: 'containerd://2.1.4' },
    },
  })),
  storageclasses: [
    {
      apiVersion: 'storage.k8s.io/v1',
      kind: 'StorageClass',
      metadata: { ...metadata('local-path', '', 24 * 150), annotations: { 'storageclass.kubernetes.io/is-default-class': 'true' } },
      provisioner: 'rancher.io/local-path',
      reclaimPolicy: 'Delete',
      volumeBindingMode: 'WaitForFirstConsumer',
      allowVolumeExpansion: true,
    },
  ],
  persistentvolumes: [
    {
      apiVersion: 'v1',
      kind: 'PersistentVolume',
      metadata: metadata('pvc-4b79f0', '', 24 * 60),
      spec: {
        capacity: { storage: '50Gi' },
        accessModes: ['ReadWriteOnce'],
        storageClassName: 'local-path',
        persistentVolumeReclaimPolicy: 'Delete',
        claimRef: { namespace: 'online-shop', name: 'postgresql-data' },
      },
      status: { phase: 'Bound' },
    },
  ],
  networkpolicies: [
    {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'NetworkPolicy',
      metadata: metadata('allow-shop-web'),
      spec: {
        podSelector: { matchLabels: { app: 'shop-web' } },
        policyTypes: ['Ingress'],
        ingress: [{ from: [{ podSelector: { matchLabels: { app: 'shop-web' } } }] }],
      },
    },
  ],
  clusterrolebindings: [
    {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'ClusterRoleBinding',
      metadata: metadata('platform-admin-binding', '', 120),
      roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'ClusterRole', name: 'platform-admin' },
      subjects: [
        { apiGroup: 'rbac.authorization.k8s.io', kind: 'User', name: 'admin' },
        { kind: 'ServiceAccount', name: 'metrics-reader', namespace: 'kube-system' },
      ],
    },
  ],
  rolebindings: [
    {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'RoleBinding',
      metadata: metadata('tenant-admin-binding', 'kubecube-tenant-digital-retail', 90),
      roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'ClusterRole', name: 'tenant-admin' },
      subjects: [{ apiGroup: 'rbac.authorization.k8s.io', kind: 'User', name: 'tenant-owner' }],
    },
  ],
  events: [
    {
      apiVersion: 'v1',
      kind: 'Event',
      metadata: metadata('shop-web-scaled'),
      type: 'Normal',
      reason: 'ScalingReplicaSet',
      message: 'Scaled up replica set shop-web to 6',
      lastTimestamp: created(1),
      count: 1,
      source: { component: 'deployment-controller' },
    },
  ],
  customresourcedefinitions: [
    {
      apiVersion: 'apiextensions.k8s.io/v1',
      kind: 'CustomResourceDefinition',
      metadata: metadata('widgets.cube.kubecube.io', '', 24 * 20),
      spec: {
        group: 'cube.kubecube.io',
        scope: 'Namespaced',
        names: { plural: 'widgets', singular: 'widget', kind: 'Widget', listKind: 'WidgetList' },
        versions: [{ name: 'v1', served: true, storage: true }],
      },
    },
  ],
  deployments: [
    workload('Deployment', 'shop-web', 6),
    workload('Deployment', 'order-service', 4),
    workload('Deployment', 'payment-gateway', 3, 2),
    workload('Deployment', 'inventory-service', 3),
    workload('Deployment', 'search-api', 2),
  ],
  statefulsets: [workload('StatefulSet', 'redis-cart', 3), workload('StatefulSet', 'postgresql-order', 2)],
  replicasets: [
    {
      apiVersion: 'apps/v1',
      kind: 'ReplicaSet',
      metadata: {
        ...metadata('shop-web-6d8f', 'online-shop', 6),
        uid: 'replicaset-shop-web-6d8f',
        annotations: { 'deployment.kubernetes.io/revision': '2' },
        ownerReferences: [{ apiVersion: 'apps/v1', kind: 'Deployment', name: 'shop-web', uid: 'deployment-shop-web' }],
      },
      spec: { replicas: 3, selector: { matchLabels: { app: 'shop-web' } } },
      status: { replicas: 3, readyReplicas: 3 },
    },
    {
      apiVersion: 'apps/v1',
      kind: 'ReplicaSet',
      metadata: {
        ...metadata('shop-web-54b7', 'online-shop', 30),
        uid: 'replicaset-shop-web-54b7',
        annotations: { 'deployment.kubernetes.io/revision': '1' },
        ownerReferences: [{ apiVersion: 'apps/v1', kind: 'Deployment', name: 'shop-web', uid: 'deployment-shop-web' }],
      },
      spec: { replicas: 0, selector: { matchLabels: { app: 'shop-web' } } },
      status: { replicas: 0, readyReplicas: 0 },
    },
  ],
  daemonsets: [workload('DaemonSet', 'node-log-collector', 8)],
  pods: Array.from({ length: 12 }, (_, index) => ({
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: {
      ...metadata(`${index % 2 ? 'order-service' : 'shop-web'}-${String(index).padStart(2, '0')}-x7d9f`, 'online-shop', 4 + index),
      labels: {
        ...metadata(`${index % 2 ? 'order-service' : 'shop-web'}-${String(index).padStart(2, '0')}-x7d9f`).labels,
        app: index % 2 ? 'order-service' : 'shop-web',
      },
      ...(index % 2 === 0
        ? {
            ownerReferences: [
              {
                apiVersion: 'apps/v1',
                kind: 'ReplicaSet',
                name: index < 6 ? 'shop-web-6d8f' : 'shop-web-54b7',
                uid: index < 6 ? 'replicaset-shop-web-6d8f' : 'replicaset-shop-web-54b7',
              },
            ],
          }
        : {}),
    },
    spec: {
      nodeName: `worker-${(index % 3) + 1}`,
      ...(index < 2 ? { volumes: [{ name: 'data', persistentVolumeClaim: { claimName: 'postgresql-data' } }] } : {}),
      containers:
        index === 0
          ? [
              ...containers,
              {
                name: 'sidecar',
                image: 'registry.example.com/shop/audit-sidecar:v1.2.0',
                resources: { requests: { cpu: '50m', memory: '64Mi' }, limits: { cpu: '200m', memory: '128Mi' } },
              },
            ]
          : containers,
    },
    status: {
      phase: index === 7 ? 'Pending' : 'Running',
      podIP: `10.244.${(index % 3) + 1}.${20 + index}`,
      hostIP: `192.168.10.${10 + (index % 3)}`,
      startTime: created(4 + index),
      containerStatuses: [{ ready: index !== 7, restartCount: index === 7 ? 2 : index % 2 }],
    },
  })),
  services: [
    {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: metadata('shop-web'),
      spec: {
        type: 'ClusterIP',
        clusterIP: '10.96.18.24',
        ports: [{ port: 80, targetPort: 8080, protocol: 'TCP' }],
        selector: { app: 'shop-web' },
      },
    },
    {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: metadata('payment-gateway'),
      spec: { type: 'NodePort', clusterIP: '10.96.20.16', ports: [{ port: 443, nodePort: 31443, protocol: 'TCP' }] },
    },
  ],
  endpoints: [
    {
      apiVersion: 'v1',
      kind: 'Endpoints',
      metadata: metadata('shop-web'),
      subsets: [
        {
          addresses: [
            { ip: '10.244.2.11', targetRef: { kind: 'Pod', name: 'shop-web-00-x7d9f' } },
            { ip: '10.244.2.12', targetRef: { kind: 'Pod', name: 'shop-web-02-x7d9f' } },
          ],
          ports: [{ port: 8080, protocol: 'TCP' }],
        },
      ],
    },
  ],
  ingresses: [
    {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'Ingress',
      metadata: metadata('shop-ingress'),
      spec: { ingressClassName: 'nginx', rules: [{ host: 'shop.example.com', http: { paths: [{ path: '/', pathType: 'Prefix' }] } }] },
      status: { loadBalancer: { ingress: [{ ip: '10.20.0.18' }] } },
    },
  ],
  configmaps: [
    {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: metadata('shop-web-config'),
      data: { 'application.yaml': 'server:\n  port: 8080\nfeature:\n  recommendations: true', LOG_LEVEL: 'info' },
    },
  ],
  secrets: [
    {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: metadata('shop-registry'),
      type: 'kubernetes.io/dockerconfigjson',
      data: { '.dockerconfigjson': 'ZXlKaGJY...' },
    },
  ],
  persistentvolumeclaims: [
    {
      apiVersion: 'v1',
      kind: 'PersistentVolumeClaim',
      metadata: metadata('postgresql-data'),
      spec: {
        accessModes: ['ReadWriteOnce'],
        storageClassName: 'local-path',
        resources: { requests: { storage: '50Gi' } },
        volumeName: 'pvc-4b79f0',
      },
      status: { phase: 'Bound', capacity: { storage: '50Gi' } },
    },
  ],
  jobs: [
    {
      apiVersion: 'batch/v1',
      kind: 'Job',
      metadata: {
        ...metadata('order-report-nightly', 'online-shop', 12),
        ownerReferences: [{ apiVersion: 'batch/v1', kind: 'CronJob', name: 'order-report', uid: 'cronjob-order-report' }],
      },
      spec: { completions: 1, template: { spec: { containers } } },
      status: { succeeded: 1, startTime: created(12), completionTime: created(11) },
    },
  ],
  cronjobs: [
    {
      apiVersion: 'batch/v1',
      kind: 'CronJob',
      metadata: { ...metadata('order-report'), uid: 'cronjob-order-report' },
      spec: { schedule: '0 2 * * *', suspend: false, jobTemplate: { spec: { template: { spec: { containers } } } } },
      status: { lastScheduleTime: created(6), active: [] },
    },
  ],
  prometheusrules: [
    {
      apiVersion: 'monitoring.coreos.com/v1',
      kind: 'PrometheusRule',
      metadata: metadata('shop-service-alerts'),
      spec: {
        groups: [
          {
            name: 'availability',
            rules: [
              {
                alert: 'HighErrorRate',
                expr: 'rate(http_requests_total{code=~"5.."}[5m]) > 0.1',
                for: '5m',
                labels: { severity: 'critical' },
              },
            ],
          },
        ],
      },
    },
  ],
  alertmanagerconfigs: [
    {
      apiVersion: 'monitoring.coreos.com/v1alpha1',
      kind: 'AlertmanagerConfig',
      metadata: metadata('shop-notifications'),
      spec: { route: { receiver: 'feishu-oncall' }, receivers: [{ name: 'feishu-oncall' }] },
    },
  ],
  logconfigs: [
    {
      apiVersion: 'logging.kubecube.io/v1',
      kind: 'LogConfig',
      metadata: metadata('shop-stdout'),
      spec: { type: 'dockerStdout', path: '/var/log/containers', matchLabels: { app: 'shop-web' } },
      status: { status: 'loaded' },
    },
  ],
}

export const namespaces: KubeResource[] = [
  {
    apiVersion: 'v1',
    kind: 'Namespace',
    cluster: 'production-shanghai',
    metadata: metadata('online-shop', '', 24 * 90),
    status: { phase: 'Active' },
  },
  {
    apiVersion: 'v1',
    kind: 'Namespace',
    cluster: 'production-shanghai',
    metadata: {
      ...metadata('member-center', '', 24 * 65),
      labels: { 'kubecube.io/tenant': 'digital-retail', 'kubecube.io/project': 'customer-growth' },
    },
    status: { phase: 'Active' },
  },
  {
    apiVersion: 'v1',
    kind: 'Namespace',
    cluster: 'staging-hangzhou',
    metadata: { ...metadata('data-platform', '', 24 * 40), labels: { 'kubecube.io/tenant': 'data-ai', 'kubecube.io/project': 'data-ai' } },
    status: { phase: 'Active' },
  },
  {
    apiVersion: 'v1',
    kind: 'Namespace',
    cluster: 'staging-hangzhou',
    metadata: {
      ...metadata('shop-staging', '', 24 * 32),
      labels: { 'kubecube.io/tenant': 'digital-retail', 'kubecube.io/project': 'online-business' },
    },
    status: { phase: 'Active' },
  },
  {
    apiVersion: 'v1',
    kind: 'Namespace',
    cluster: 'production-shanghai',
    unmanaged: true,
    metadata: { ...metadata('legacy-import', '', 24 * 10), labels: {} },
    status: { phase: 'Active' },
  },
]

export const tenants: KubeResource[] = [
  {
    apiVersion: 'tenant.kubecube.io/v1',
    kind: 'Tenant',
    metadata: metadata('digital-retail', '', 24 * 180),
    spec: { displayName: '数字零售事业部', description: '线上商城与会员业务' },
  },
  {
    apiVersion: 'tenant.kubecube.io/v1',
    kind: 'Tenant',
    metadata: metadata('data-ai', '', 24 * 120),
    spec: { displayName: '数据与智能中心', description: '数据平台与算法服务' },
  },
]

export const projects: KubeResource[] = [
  {
    apiVersion: 'tenant.kubecube.io/v1',
    kind: 'Project',
    metadata: metadata('online-business', '', 24 * 160),
    spec: { displayName: '线上业务', namespace: 'online-business', description: '商城交易核心业务' },
  },
  {
    apiVersion: 'tenant.kubecube.io/v1',
    kind: 'Project',
    metadata: metadata('customer-growth', '', 24 * 90),
    spec: { displayName: '用户增长', namespace: 'customer-growth', description: '会员、营销与增长' },
  },
]

export const users: KubeResource[] = [
  {
    name: 'admin',
    metadata: metadata('admin', '', 24 * 200),
    spec: {
      displayName: '平台管理员',
      email: 'admin@kubecube.io',
      state: 'active',
      lastLogin: created(2),
      scopeBindings: [{ scopeType: 'platform', scopeName: 'platform', role: 'platform-admin' }],
    },
  },
  {
    name: 'zhang.wei',
    metadata: metadata('zhang.wei', '', 24 * 100),
    spec: {
      displayName: '张 伟',
      email: 'zhang.wei@example.com',
      state: 'active',
      lastLogin: created(8),
      scopeBindings: [
        { scopeType: 'tenant', scopeName: 'digital-retail', role: 'tenant-admin' },
        { scopeType: 'project', scopeName: 'online-business', role: 'project-admin' },
      ],
    },
  },
  {
    name: 'li.na',
    metadata: metadata('li.na', '', 24 * 80),
    spec: {
      displayName: '李 娜',
      email: 'li.na@example.com',
      state: 'active',
      lastLogin: created(30),
      scopeBindings: [{ scopeType: 'project', scopeName: 'online-business', role: 'project-viewer' }],
    },
  },
]

const role = (
  name: string,
  scope: string,
  displayName: string,
  description: string,
  builtIn: boolean,
  items: Record<string, string>,
): KubeResource => ({
  apiVersion: 'rbac.authorization.k8s.io/v1',
  kind: 'ClusterRole',
  ...(builtIn ? { aggregationRule: {} } : {}),
  metadata: { ...metadata(name, '', 24 * 220), labels: { 'kubecube.io/rbac': 'true', 'kubecube.io/role': scope } },
  spec: { displayName, description, builtIn, items },
})

export const roles: KubeResource[] = [
  role('platform-admin', 'platform', '平台管理员', '管理整个平台', true, {
    'dashboard.read': 'all',
    'users.manage': 'all',
    'tenants.manage': 'all',
    'projects.manage': 'all',
  }),
  role('tenant-admin', 'tenant', '租户管理员', '管理租户及项目', true, {
    'dashboard.read': 'all',
    'tenants.manage': 'all',
    'projects.manage': 'all',
    'deployments.manage': 'all',
    'services.manage': 'all',
    'configmaps.manage': 'all',
  }),
  role('project-admin', 'project', '项目管理员', '管理项目内资源', true, {
    'dashboard.read': 'all',
    'projects.manage': 'all',
    'deployments.manage': 'all',
    'services.manage': 'all',
    'configmaps.manage': 'all',
  }),
  role('project-viewer', 'project', '项目只读成员', '查看项目内工作负载与配置', false, {
    'dashboard.read': 'read',
    'deployments.manage': 'read',
    'services.manage': 'read',
    'configmaps.manage': 'read',
  }),
]

export const roleCatalogue = {
  items: {
    'dashboard.read': { resources: 'dashboards', levels: ['platform', 'tenant', 'project'] },
    'users.manage': { resources: 'users', levels: ['platform'] },
    'tenants.manage': { resources: 'tenants', levels: ['platform', 'tenant'] },
    'projects.manage': { resources: 'projects', levels: ['platform', 'tenant', 'project'] },
    'deployments.manage': { resources: 'deployments;deployments/scale', levels: ['tenant', 'project'] },
    'services.manage': { resources: 'services', levels: ['tenant', 'project'] },
    'configmaps.manage': { resources: 'configmaps', levels: ['tenant', 'project'] },
  },
}

export const quotas: KubeResource[] = [
  {
    apiVersion: 'quota.kubecube.io/v1',
    kind: 'CubeResourceQuota',
    metadata: {
      ...metadata('production-shanghai.digital-retail', '', 24 * 100),
      labels: { 'kubecube.io/cluster': 'production-shanghai', 'kubecube.io/tenant': 'digital-retail' },
      annotations: { 'kubecube.io/sync': 'true' },
    },
    spec: {
      hard: {
        'requests.cpu': '32',
        'limits.cpu': '64',
        'requests.memory': '64Gi',
        'limits.memory': '128Gi',
        'requests.nvidia.com/gpu': '2',
        'limits.nvidia.com/gpu': '4',
      },
      target: { name: 'digital-retail', kind: 'Tenant' },
    },
    status: {
      hard: {
        'requests.cpu': '32',
        'limits.cpu': '64',
        'requests.memory': '64Gi',
        'limits.memory': '128Gi',
        'requests.nvidia.com/gpu': '2',
        'limits.nvidia.com/gpu': '4',
      },
      used: {
        'requests.cpu': '8',
        'limits.cpu': '16',
        'requests.memory': '16Gi',
        'limits.memory': '32Gi',
        'requests.nvidia.com/gpu': '0',
        'limits.nvidia.com/gpu': '0',
      },
    },
  },
]

export const apiKeys: KubeResource[] = [
  {
    apiVersion: 'user.kubecube.io/v1',
    kind: 'Key',
    name: '自动化发布密钥',
    metadata: metadata('ak_prod_9f27c1a684f24bd2', '', 24 * 30),
    spec: { secretKey: 'sk_mock_64ac071c3ab948f28e0b7f56e9294a11', user: 'admin' },
    lastUsedAt: created(1),
  },
]

export const auditItems = Array.from({ length: 18 }, (_, index) => ({
  id: `audit-${index + 1}`,
  user: index % 3 === 0 ? 'admin' : 'zhang.wei',
  action: ['更新', '创建', '删除', '查询'][index % 4],
  resourceType: ['Deployment', 'ConfigMap', 'Namespace', 'User'][index % 4],
  resourceName: ['shop-web', 'shop-web-config', 'online-shop', 'li.na'][index % 4],
  cluster: index % 2 ? 'production-shanghai' : 'pivot-cluster',
  namespace: 'online-shop',
  sourceIp: `10.20.1.${30 + index}`,
  status: index === 6 ? 'failed' : 'success',
  timestamp: created(index + 1),
}))
