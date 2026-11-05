<template>
  <div class="page page-stack">
    <PageHeader :title="nodeName" :description="`所属集群：${clusterName}`" :breadcrumbs="['平台管理', '集群管理', '节点详情']">
      <template #badge><StatusTag :status="nodeReady ? 'Ready' : 'NotReady'" :label="nodeReady ? '就绪' : '未就绪'" /></template>
      <template #actions
        ><el-button @click="router.push(`/platform/cluster/${encodeURIComponent(clusterName)}/node`)">返回节点列表</el-button
        ><el-button :disabled="!node" @click="openYaml">只读 YAML</el-button
        ><el-button :icon="Refresh" :loading="nodeLoading || tabLoading" @click="refresh">刷新</el-button></template
      >
    </PageHeader>

    <el-alert v-if="nodeError" type="error" :title="nodeError" show-icon :closable="false"
      ><template #default><el-button link type="primary" @click="loadNode">重新加载节点</el-button></template></el-alert
    >
    <section v-if="node" class="surface node-summary">
      <div>
        <span>Internal IP</span><strong>{{ nodeAddress('InternalIP') }}</strong>
      </div>
      <div>
        <span>操作系统</span><strong>{{ text(getByPath(node, 'status.nodeInfo.osImage')) }}</strong>
      </div>
      <div>
        <span>Kubelet 版本</span><strong>{{ text(getByPath(node, 'status.nodeInfo.kubeletVersion')) }}</strong>
      </div>
      <div>
        <span>调度状态</span><strong>{{ getByPath(node, 'spec.unschedulable') ? '禁止调度' : '允许调度' }}</strong>
      </div>
    </section>

    <section class="surface detail-surface">
      <el-tabs :model-value="activeTab" class="detail-tabs" @tab-change="changeTab"
        ><el-tab-pane v-for="tab in tabs" :key="tab.name" :label="tab.label" :name="tab.name"
      /></el-tabs>
      <div class="tab-content">
        <template v-if="activeTab === 'info'">
          <el-skeleton v-if="nodeLoading && !node" animated :rows="8" />
          <template v-else-if="node">
            <h2>运行环境</h2>
            <el-descriptions :column="2" border class="info-block">
              <el-descriptions-item label="节点名称">{{ node.metadata.name }}</el-descriptions-item
              ><el-descriptions-item label="创建时间">{{ formatDate(node.metadata.creationTimestamp) }}</el-descriptions-item>
              <el-descriptions-item label="内核版本">{{ text(getByPath(node, 'status.nodeInfo.kernelVersion')) }}</el-descriptions-item
              ><el-descriptions-item label="容器运行时">{{
                text(getByPath(node, 'status.nodeInfo.containerRuntimeVersion'))
              }}</el-descriptions-item>
              <el-descriptions-item label="Kube Proxy">{{ text(getByPath(node, 'status.nodeInfo.kubeProxyVersion')) }}</el-descriptions-item
              ><el-descriptions-item label="架构">{{ text(getByPath(node, 'status.nodeInfo.architecture')) }}</el-descriptions-item>
              <el-descriptions-item label="CPU 容量 / 可分配"
                >{{ text(getByPath(node, 'status.capacity.cpu')) }} /
                {{ text(getByPath(node, 'status.allocatable.cpu')) }}</el-descriptions-item
              ><el-descriptions-item label="内存容量 / 可分配"
                >{{ text(getByPath(node, 'status.capacity.memory')) }} /
                {{ text(getByPath(node, 'status.allocatable.memory')) }}</el-descriptions-item
              >
              <el-descriptions-item label="Pod 容量 / 可分配"
                >{{ text(getByPath(node, 'status.capacity.pods')) }} /
                {{ text(getByPath(node, 'status.allocatable.pods')) }}</el-descriptions-item
              ><el-descriptions-item label="临时存储">{{
                text(getByPath(node, 'status.capacity.ephemeral-storage'))
              }}</el-descriptions-item>
            </el-descriptions>
            <h2>节点属性</h2>
            <el-descriptions :column="2" border class="info-block"
              ><el-descriptions-item v-for="fact in nodeFacts" :key="fact.label" :label="fact.label">{{
                fact.value
              }}</el-descriptions-item></el-descriptions
            >
            <h2>节点状态</h2>
            <el-table :data="nodeConditions" class="info-block"
              ><el-table-column prop="type" label="类型" width="180" /><el-table-column label="状态" width="110"
                ><template #default="{ row }"
                  ><StatusTag :status="row.status === 'True' ? 'True' : 'False'" :label="row.status" /></template></el-table-column
              ><el-table-column prop="reason" label="原因" min-width="160" /><el-table-column
                prop="message"
                label="信息"
                min-width="250"
              /><el-table-column label="最后心跳" width="170"
                ><template #default="{ row }">{{ formatDate(row.lastHeartbeatTime) }}</template></el-table-column
              ></el-table
            >
            <div class="metadata-grid">
              <div>
                <h2>标签</h2>
                <div v-if="labelEntries.length" class="tag-list">
                  <el-tag v-for="entry in labelEntries" :key="entry[0]" effect="plain">{{ entry[0] }}={{ entry[1] }}</el-tag>
                </div>
                <span v-else class="text-secondary">暂无标签</span>
              </div>
              <div>
                <h2>污点</h2>
                <div v-if="nodeTaints.length" class="tag-list">
                  <el-tag v-for="(taint, index) in nodeTaints" :key="index" type="warning" effect="plain"
                    >{{ taint.key }}{{ taint.value ? `=${taint.value}` : '' }}:{{ taint.effect }}</el-tag
                  >
                </div>
                <span v-else class="text-secondary">暂无污点</span>
              </div>
            </div>
          </template>
          <EmptyState v-else-if="!nodeLoading" title="节点详情不可用" description="请根据上方错误信息重试，或返回节点列表。" />
        </template>

        <template v-else-if="activeTab === 'pod'">
          <div class="section-heading">
            <div>
              <h2>节点上的 Pod</h2>
              <p>使用 spec.nodeName 字段选择器查询当前节点。</p>
            </div>
            <el-input v-model="podKeyword" :prefix-icon="Search" clearable placeholder="搜索 Pod 或空间" class="search-input" />
          </div>
          <el-alert v-if="tabError" :title="tabError" type="error" show-icon :closable="false" class="tab-alert" />
          <el-table v-loading="tabLoading" :data="filteredPods" row-key="metadata.uid">
            <el-table-column label="Pod" min-width="240" fixed="left"
              ><template #default="{ row }">{{ row.metadata.name }}</template></el-table-column
            >
            <el-table-column label="空间" min-width="150"
              ><template #default="{ row }">{{ row.metadata.namespace }}</template></el-table-column
            >
            <el-table-column label="状态" width="110"
              ><template #default="{ row }"><StatusTag :status="String(getByPath(row, 'status.phase') || '')" /></template
            ></el-table-column>
            <el-table-column label="Pod IP" min-width="130"
              ><template #default="{ row }">{{ text(getByPath(row, 'status.podIP')) }}</template></el-table-column
            >
            <el-table-column label="重启次数" width="110" align="center"
              ><template #default="{ row }">{{ restartCount(row) }}</template></el-table-column
            >
            <el-table-column label="创建时间" width="170"
              ><template #default="{ row }">{{ formatDate(row.metadata.creationTimestamp) }}</template></el-table-column
            >
            <template #empty
              ><EmptyState v-if="!tabLoading && !tabError" title="暂无 Pod" description="当前节点没有 Pod，或没有符合筛选条件的 Pod。"
            /></template>
          </el-table>
        </template>

        <template v-else-if="activeTab === 'monitor'">
          <div class="section-heading">
            <div>
              <h2>节点监控</h2>
              <p>数据来自监控接口的 PromQL 即时查询。</p>
            </div>
            <el-button :icon="Refresh" :loading="tabLoading" @click="loadTab">重新查询</el-button>
          </div>
          <el-alert v-if="tabError" :title="tabError" type="error" show-icon :closable="false" class="tab-alert" />
          <div v-if="tabLoading && !metrics.length" class="metrics-grid">
            <el-skeleton v-for="i in 3" :key="i" class="metric-skeleton" animated :rows="2" />
          </div>
          <div v-else-if="metrics.length" v-loading="tabLoading" class="metrics-grid">
            <MetricCard
              v-for="metric in metrics"
              :key="metric.label"
              :label="metric.label"
              :value="metricDisplay(metric).value"
              :unit="metricDisplay(metric).unit"
              :caption="metric.value ? '即时查询成功' : '查询成功，但暂无匹配数据'"
              :tone="metric.tone"
            />
          </div>
          <EmptyState v-else-if="!tabLoading && !tabError" title="暂无监控数据" description="监控接口尚未返回当前节点指标。" />
          <el-collapse v-if="metrics.length" class="query-collapse"
            ><el-collapse-item title="查看本次 PromQL" name="q"
              ><div v-for="metric in metrics" :key="metric.label" class="query-row">
                <span>{{ metric.label }}</span
                ><code>{{ metric.query }}</code>
              </div></el-collapse-item
            ></el-collapse
          >
        </template>

        <template v-else>
          <div class="section-heading">
            <div>
              <h2>节点事件</h2>
              <p>按 involvedObject.kind 和 name 查询 Kubernetes Events。</p>
            </div>
            <el-button :icon="Refresh" :loading="tabLoading" @click="loadTab">刷新</el-button>
          </div>
          <el-alert v-if="tabError" :title="tabError" type="error" show-icon :closable="false" class="tab-alert" />
          <el-table v-loading="tabLoading" :data="events" row-key="metadata.uid">
            <el-table-column label="类型" width="100"
              ><template #default="{ row }"
                ><el-tag :type="getByPath(row, 'type') === 'Warning' ? 'warning' : 'info'" effect="plain">{{
                  text(getByPath(row, 'type'))
                }}</el-tag></template
              ></el-table-column
            >
            <el-table-column label="原因" min-width="150"
              ><template #default="{ row }">{{ text(getByPath(row, 'reason')) }}</template></el-table-column
            >
            <el-table-column label="消息" min-width="320"
              ><template #default="{ row }">{{ text(getByPath(row, 'message') || getByPath(row, 'note')) }}</template></el-table-column
            >
            <el-table-column label="次数" width="90" align="center"
              ><template #default="{ row }">{{
                text(getByPath(row, 'count') || getByPath(row, 'series.count'))
              }}</template></el-table-column
            >
            <el-table-column label="最后出现" width="175"
              ><template #default="{ row }">{{
                formatDate(String(getByPath(row, 'lastTimestamp') || getByPath(row, 'eventTime') || ''))
              }}</template></el-table-column
            >
            <template #empty
              ><EmptyState v-if="!tabLoading && !tabError" title="暂无事件" description="当前节点没有相关 Kubernetes 事件。"
            /></template>
          </el-table>
        </template>
      </div>
    </section>
    <YamlEditorDialog v-model="yamlOpen" :title="`${nodeName} · 节点只读 YAML`" :content="yamlContent" :read-only="true" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Refresh, Search } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import MetricCard from '@/components/MetricCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import YamlEditorDialog from '@/components/YamlEditorDialog.vue'
import { monitorApi } from '@/api/observability'
import { resourceApi, type ResourceDefinition } from '@/api/resource'
import type { KubeResource } from '@/types/api'
import { asText, formatDate, formatNumber, getByPath } from '@/utils/format'
import { toYAML } from '@/utils/yaml'

type TabName = 'info' | 'pod' | 'monitor' | 'event'
interface NodeCondition {
  type?: string
  status?: string
  reason?: string
  message?: string
  lastHeartbeatTime?: string
}
interface NodeTaint {
  key?: string
  value?: string
  effect?: string
}
interface MonitorMetric {
  label: string
  value: string
  unit: string
  query: string
  tone: 'brand' | 'success' | 'info'
}
interface PrometheusResponse {
  data?: { result?: Array<{ value?: [number | string, string] }> }
}
const tabs: Array<{ name: TabName; label: string }> = [
  { name: 'info', label: '详情' },
  { name: 'pod', label: 'Pod' },
  { name: 'monitor', label: '监控' },
  { name: 'event', label: '事件' },
]
const nodeDefinition: ResourceDefinition = { plural: 'nodes', kind: 'Node', version: 'v1', namespaced: false }
const podDefinition: ResourceDefinition = { plural: 'pods', kind: 'Pod', version: 'v1', namespaced: false }
const eventDefinition: ResourceDefinition = { plural: 'events', kind: 'Event', version: 'v1', namespaced: false }
const route = useRoute()
const router = useRouter()
const node = ref<KubeResource>()
const nodeLoading = ref(false)
const nodeError = ref('')
const pods = ref<KubeResource[]>([])
const events = ref<KubeResource[]>([])
const metrics = ref<MonitorMetric[]>([])
const tabLoading = ref(false)
const tabError = ref('')
const podKeyword = ref('')
const yamlOpen = ref(false)
const yamlContent = ref('')
let nodeGeneration = 0
let tabGeneration = 0
const clusterName = computed(() => String(route.params.name || ''))
const nodeName = computed(() => String(route.params.nodename || ''))
const activeTab = computed<TabName>(() => (tabs.some((tab) => tab.name === route.params.tab) ? (route.params.tab as TabName) : 'info'))
const nodeReady = computed(() => nodeConditions.value.some((item) => item.type === 'Ready' && item.status === 'True'))
const nodeConditions = computed<NodeCondition[]>(() => (getByPath(node.value, 'status.conditions') as NodeCondition[] | undefined) || [])
const nodeTaints = computed<NodeTaint[]>(() => (getByPath(node.value, 'spec.taints') as NodeTaint[] | undefined) || [])
const labelEntries = computed(() => Object.entries(node.value?.metadata.labels || {}))
const nodeFacts = computed<Array<{ label: string; value: string }>>(() => {
  const current = node.value
  if (!current) return []
  const labels = current.metadata.labels || {}
  const status = (current.status || {}) as Record<string, any>
  const addresses = Array.isArray(status.addresses) ? status.addresses : []
  const address = (type: string) => String(addresses.find((item: Record<string, unknown>) => item.type === type)?.address || '—')
  const roles = ['master', 'control-plane', 'worker'].filter((role) => labels[`node-role.kubernetes.io/${role}`] !== undefined).join(', ')
  const instanceType = labels['node.kubernetes.io/instance-type'] || labels['kubecube.io/node-type'] || '—'
  const gpu = status.capacity?.['nvidia.com/gpu'] || status.allocatable?.['nvidia.com/gpu'] || labels['nvidia.com/gpu.product'] || '0'
  return [
    { label: '节点角色', value: roles || '—' },
    { label: '实例类型', value: instanceType },
    { label: 'GPU', value: String(gpu) },
    { label: '内网 IP', value: address('InternalIP') },
    { label: '外网 IP', value: address('ExternalIP') },
    { label: '主机名', value: address('Hostname') },
    { label: '操作系统', value: String(status.nodeInfo?.osImage || status.nodeInfo?.operatingSystem || '—') },
    { label: 'Kubelet', value: String(status.nodeInfo?.kubeletVersion || '—') },
    { label: 'Pod CIDR', value: String((current.spec as Record<string, any> | undefined)?.podCIDR || '—') },
    { label: '污点数量', value: String(nodeTaints.value.length) },
  ]
})
const filteredPods = computed(() => {
  const keyword = podKeyword.value.trim().toLowerCase()
  return keyword
    ? pods.value.filter((item) =>
        [item.metadata.name, item.metadata.namespace].some((value) =>
          String(value || '')
            .toLowerCase()
            .includes(keyword),
        ),
      )
    : pods.value
})
function text(value: unknown) {
  return asText(value)
}
function errorText(error: unknown) {
  return error instanceof Error ? error.message : '请求失败，请稍后重试'
}
function nodeAddress(type: string) {
  const addresses = (getByPath(node.value, 'status.addresses') as Array<{ type?: string; address?: string }> | undefined) || []
  return addresses.find((item) => item.type === type)?.address || '—'
}
function restartCount(row: KubeResource) {
  const statuses = (getByPath(row, 'status.containerStatuses') as Array<{ restartCount?: number }> | undefined) || []
  return statuses.reduce((sum, item) => sum + (item.restartCount || 0), 0)
}
function changeTab(name: string | number) {
  if (tabs.some((tab) => tab.name === name))
    router.push({
      path: `/platform/cluster/${encodeURIComponent(clusterName.value)}/${encodeURIComponent(nodeName.value)}/${String(name)}`,
      query: route.query,
    })
}
function openYaml() {
  if (!node.value) return
  yamlContent.value = toYAML(node.value)
  yamlOpen.value = true
}
async function loadNode() {
  if (!clusterName.value || !nodeName.value) return
  const generation = ++nodeGeneration
  nodeLoading.value = true
  nodeError.value = ''
  try {
    const response = await resourceApi.get(nodeDefinition, { cluster: clusterName.value, name: nodeName.value })
    if (generation === nodeGeneration) node.value = response
  } catch (error) {
    if (generation === nodeGeneration) nodeError.value = `节点信息加载失败：${errorText(error)}`
  } finally {
    if (generation === nodeGeneration) nodeLoading.value = false
  }
}
function escaped(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
}
function metricDisplay(metric: MonitorMetric) {
  if (!metric.value) return { value: '暂无数据', unit: '' }
  const value = Number(metric.value)
  if (!Number.isFinite(value)) return { value: metric.value, unit: metric.unit }
  return metric.unit === '%' ? { value: formatNumber(value * 100, 1), unit: '%' } : { value: formatNumber(value, 2), unit: metric.unit }
}
async function loadMonitor(generation: number) {
  const selector = `cluster="${escaped(clusterName.value)}",node="${escaped(nodeName.value)}"`
  const definitions = [
    { label: 'CPU 空闲率', unit: '%', tone: 'brand' as const, query: `avg(rate(node_cpu_seconds_total{${selector},mode="idle"}[5m]))` },
    {
      label: '内存可用率',
      unit: '%',
      tone: 'info' as const,
      query: `node_memory_MemAvailable_bytes{${selector}} / node_memory_MemTotal_bytes{${selector}}`,
    },
    { label: '1 分钟负载', unit: '', tone: 'success' as const, query: `node_load1{${selector}}` },
  ]
  const responses = await Promise.all(definitions.map((item) => monitorApi.query({ query: item.query, time: Date.now() / 1000 })))
  if (generation === tabGeneration)
    metrics.value = definitions.map((item, index) => ({
      ...item,
      value: (responses[index] as PrometheusResponse)?.data?.result?.[0]?.value?.[1] || '',
    }))
}
async function loadTab() {
  if (activeTab.value === 'info' || !clusterName.value || !nodeName.value) return
  const generation = ++tabGeneration
  tabLoading.value = true
  tabError.value = ''
  try {
    if (activeTab.value === 'monitor') await loadMonitor(generation)
    else if (activeTab.value === 'pod') {
      const response = await resourceApi.list(podDefinition, { cluster: clusterName.value }, {
        pageNum: 1,
        pageSize: 1000,
        fieldSelector: `spec.nodeName=${nodeName.value}`,
      } as Parameters<typeof resourceApi.list>[2])
      if (generation === tabGeneration) pods.value = response.items || []
    } else {
      const response = await resourceApi.list(eventDefinition, { cluster: clusterName.value }, {
        pageNum: 1,
        pageSize: 1000,
        fieldSelector: `involvedObject.kind=Node,involvedObject.name=${nodeName.value}`,
      } as Parameters<typeof resourceApi.list>[2])
      if (generation === tabGeneration) events.value = response.items || []
    }
  } catch (error) {
    if (generation === tabGeneration)
      tabError.value = `${tabs.find((tab) => tab.name === activeTab.value)?.label || '数据'}加载失败：${errorText(error)}`
  } finally {
    if (generation === tabGeneration) tabLoading.value = false
  }
}
function refresh() {
  void loadNode()
  void loadTab()
}
watch(
  [clusterName, nodeName],
  ([clusterValue, nodeValue], previous) => {
    if (!previous || clusterValue !== previous[0] || nodeValue !== previous[1]) {
      node.value = undefined
      pods.value = []
      events.value = []
      metrics.value = []
      void loadNode()
    }
  },
  { immediate: true },
)
watch(
  [clusterName, nodeName, activeTab],
  (current, previous) => {
    if (!previous || current.some((value, index) => value !== previous[index])) {
      pods.value = []
      events.value = []
      metrics.value = []
      tabError.value = ''
      podKeyword.value = ''
      void loadTab()
    }
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  nodeGeneration++
  tabGeneration++
})
</script>

<style scoped>
.node-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 20px;
  padding: 20px 24px;
}
.node-summary div {
  min-width: 0;
}
.node-summary span {
  display: block;
  margin-bottom: 5px;
  color: var(--text-secondary);
  font-size: 12px;
}
.node-summary strong {
  display: block;
  overflow: hidden;
  font-weight: 550;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.detail-surface {
  overflow: hidden;
}
.detail-tabs {
  padding: 0 24px;
  border-bottom: 1px solid var(--border-light);
}
.detail-tabs :deep(.el-tabs__header) {
  margin: 0;
}
.detail-tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}
.tab-content {
  min-height: 360px;
  padding: 24px;
}
h2 {
  margin-bottom: 14px;
  font-size: 16px;
}
.info-block {
  margin-bottom: 26px;
}
.metadata-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
}
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.tag-list .el-tag {
  max-width: 100%;
  height: auto;
  min-height: 28px;
  white-space: normal;
  word-break: break-all;
}
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}
.section-heading h2 {
  margin: 0;
}
.section-heading p {
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 13px;
}
.search-input {
  width: 260px;
}
.tab-alert {
  margin-bottom: 16px;
}
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
.metric-skeleton {
  padding: 24px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
}
.query-collapse {
  margin-top: 20px;
}
.query-row {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr);
  gap: 16px;
  padding: 8px 0;
}
.query-row code {
  overflow-wrap: anywhere;
  color: var(--text-secondary);
}
@media (max-width: 1000px) {
  .node-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 720px) {
  .detail-tabs {
    padding: 0 14px;
    overflow-x: auto;
  }
  .tab-content {
    padding: 16px;
  }
  .section-heading {
    align-items: stretch;
    flex-direction: column;
  }
  .search-input {
    width: 100%;
  }
  .metrics-grid,
  .metadata-grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 520px) {
  .node-summary {
    grid-template-columns: 1fr;
    gap: 14px;
    padding: 16px;
  }
  .query-row {
    grid-template-columns: 1fr;
    gap: 4px;
  }
}
</style>
