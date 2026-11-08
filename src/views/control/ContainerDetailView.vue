<template>
  <div class="page page-stack">
    <PageHeader :title="containerName" :description="`${podName} · 容器详情`" :breadcrumbs="['资源控制台', 'Pods', podName, containerName]"
      ><template #badge><StatusTag :status="containerReady ? '运行正常' : '未就绪'" /></template
      ><template #actions
        ><el-button @click="router.back()">返回</el-button
        ><el-button @click="loadLogs"
          ><el-icon><Refresh /></el-icon>刷新日志</el-button
        ><el-button type="primary" @click="ui.openShell(podName, containerName)"
          ><el-icon><Monitor /></el-icon>打开终端</el-button
        ></template
      ></PageHeader
    >
    <section class="surface surface-padded" v-loading="loading">
      <div class="section-heading">
        <h2>容器配置</h2>
        <el-tag effect="plain">{{ container?.image || '—' }}</el-tag>
      </div>
      <el-descriptions :column="2" border
        ><el-descriptions-item label="容器名称">{{ containerName }}</el-descriptions-item
        ><el-descriptions-item label="所在 Pod"
          ><span class="mono">{{ podName }}</span></el-descriptions-item
        ><el-descriptions-item label="镜像拉取策略">{{ container?.imagePullPolicy || '—' }}</el-descriptions-item
        ><el-descriptions-item label="重启次数">{{ containerStatus?.restartCount ?? 0 }}</el-descriptions-item
        ><el-descriptions-item label="运行状态">{{ stateText }}</el-descriptions-item
        ><el-descriptions-item label="镜像 ID" :span="2"
          ><span class="mono">{{ containerStatus?.imageID || '—' }}</span></el-descriptions-item
        ><el-descriptions-item label="CPU 请求 / 限制">{{ resourceValue('cpu') }}</el-descriptions-item
        ><el-descriptions-item label="内存请求 / 限制">{{ resourceValue('memory') }}</el-descriptions-item></el-descriptions
      >
      <div v-if="container?.command?.length || container?.args?.length" class="command-block">
        <h3>启动命令</h3>
        <pre>{{ commandText }}</pre>
      </div>
      <div class="container-grid">
        <div>
          <h3>端口</h3>
          <el-table :data="container?.ports || []"
            ><el-table-column prop="name" label="名称" /><el-table-column prop="containerPort" label="容器端口" /><el-table-column
              prop="protocol"
              label="协议"
          /></el-table>
        </div>
        <div>
          <h3>环境变量</h3>
          <el-table :data="container?.env || []"
            ><el-table-column prop="name" label="名称" /><el-table-column label="值" show-overflow-tooltip
              ><template #default="{ row }">{{ envValue(row) }}</template></el-table-column
            ></el-table
          >
        </div>
      </div>
      <div class="container-grid">
        <div>
          <h3>挂载卷</h3>
          <el-table :data="mounts" empty-text="未挂载存储卷"
            ><el-table-column prop="name" label="卷" min-width="110" /><el-table-column
              prop="mountPath"
              label="挂载路径"
              min-width="160"
            /><el-table-column prop="source" label="来源" min-width="180" /><el-table-column label="只读" width="80"
              ><template #default="{ row }">{{ row.readOnly ? '是' : '否' }}</template></el-table-column
            ></el-table
          >
        </div>
        <div>
          <h3>健康探针</h3>
          <el-table :data="probes" empty-text="未配置探针"
            ><el-table-column prop="type" label="类型" width="110" /><el-table-column
              prop="method"
              label="检查方式"
              width="100"
            /><el-table-column prop="target" label="目标" min-width="180" /><el-table-column label="参数" min-width="170"
              ><template #default="{ row }">{{ row.timing }}</template></el-table-column
            ></el-table
          >
        </div>
      </div>
    </section>
    <section class="surface log-section">
      <div class="section-heading">
        <div>
          <h2>容器日志</h2>
          <p>最近 500 行标准输出</p>
        </div>
        <el-button text @click="copyLogs">复制日志</el-button>
      </div>
      <pre>{{ logs || '暂无日志' }}</pre>
    </section>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Monitor, Refresh } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import { resourceApi, type ResourceDefinition } from '@/api/resource'
import { useScopeStore } from '@/stores/scope'
import { useUiStore } from '@/stores/ui'
import { formatPodLogs, podLogQuery } from '@/utils/pod-log'
import type { KubeResource } from '@/types/api'
const route = useRoute()
const router = useRouter()
const scope = useScopeStore()
const ui = useUiStore()
const podName = computed(() => String(route.params.pod))
const containerName = computed(() => String(route.params.container))
const pod = ref<KubeResource>()
const loading = ref(false)
const logs = ref('')
const definition: ResourceDefinition = { plural: 'pods', kind: 'Pod', group: '', version: 'v1', namespaced: true }
const container = computed(
  () =>
    ((pod.value?.spec as Record<string, any>)?.containers || []).find(
      (item: Record<string, unknown>) => item.name === containerName.value,
    ) as Record<string, any> | undefined,
)
const containerStatus = computed(
  () =>
    ((pod.value?.status as Record<string, any>)?.containerStatuses || []).find(
      (item: Record<string, unknown>) => item.name === containerName.value,
    ) as Record<string, any> | undefined,
)
const containerReady = computed(() => containerStatus.value?.ready === true)
const stateText = computed(() => {
  const state = containerStatus.value?.state || {}
  if (state.running) return `Running · 自 ${new Date(state.running.startedAt).toLocaleString()}`
  if (state.waiting) return `Waiting · ${state.waiting.reason || '等待中'}`
  if (state.terminated) return `Terminated · ${state.terminated.reason || '已退出'} (${state.terminated.exitCode ?? '—'})`
  return '未知'
})
const commandText = computed(() => {
  const command = container.value?.command || []
  const args = container.value?.args || []
  if (!command.length && !args.length) return '使用镜像默认 Entrypoint / Cmd'
  return [command.length ? `command: ${command.join(' ')}` : '', args.length ? `args: ${args.join(' ')}` : ''].filter(Boolean).join('\n')
})
function envValue(row: Record<string, any>) {
  if (row.value !== undefined) return row.value
  const source = row.valueFrom || {}
  if (source.secretKeyRef)
    return `Secret ${source.secretKeyRef.name}/${source.secretKeyRef.key}${source.secretKeyRef.optional ? '（可选）' : ''}`
  if (source.configMapKeyRef)
    return `ConfigMap ${source.configMapKeyRef.name}/${source.configMapKeyRef.key}${source.configMapKeyRef.optional ? '（可选）' : ''}`
  if (source.fieldRef) return `FieldRef ${source.fieldRef.fieldPath}`
  if (source.resourceFieldRef) return `ResourceFieldRef ${source.resourceFieldRef.resource}`
  return '—'
}
const volumeMap = computed(() => {
  const volumes = ((pod.value?.spec as Record<string, any>)?.volumes || []) as Array<Record<string, any>>
  return new Map(volumes.map((volume) => [volume.name, volume]))
})
function volumeSource(name: string) {
  const volume = volumeMap.value.get(name) || {}
  if (volume.persistentVolumeClaim) return `PVC ${volume.persistentVolumeClaim.claimName}`
  if (volume.configMap) return `ConfigMap ${volume.configMap.name}`
  if (volume.secret) return `Secret ${volume.secret.secretName}`
  if (volume.emptyDir) return `EmptyDir${volume.emptyDir.medium ? ` (${volume.emptyDir.medium})` : ''}`
  if (volume.hostPath) return `HostPath ${volume.hostPath.path}`
  if (volume.projected) return 'Projected'
  if (volume.nfs) return `NFS ${volume.nfs.server}:${volume.nfs.path}`
  return '其他卷类型'
}
const mounts = computed(() => {
  const rows = (container.value?.volumeMounts || []) as Array<Record<string, any>>
  return rows.map((mount) => ({
    name: mount.name,
    mountPath: mount.mountPath,
    source: volumeSource(String(mount.name)),
    readOnly: Boolean(mount.readOnly),
  }))
})
function probeDetail(probe: Record<string, any> | undefined) {
  if (!probe) return { method: '—', target: '—', timing: '—' }
  let method = 'Exec'
  let target = (probe.exec?.command || []).join(' ')
  if (probe.httpGet) {
    method = 'HTTP'
    target = `${probe.httpGet.scheme || 'HTTP'} :${probe.httpGet.port}${probe.httpGet.path || '/'}`
  } else if (probe.tcpSocket) {
    method = 'TCP'
    target = `:${probe.tcpSocket.port}`
  } else if (probe.grpc) {
    method = 'gRPC'
    target = `:${probe.grpc.port}`
  }
  const timing = [
    `initial ${probe.initialDelaySeconds ?? 0}s`,
    `period ${probe.periodSeconds ?? 10}s`,
    `timeout ${probe.timeoutSeconds ?? 1}s`,
    `failure ${probe.failureThreshold ?? 3}`,
  ].join(' · ')
  return { method, target: target || '—', timing }
}
const probes = computed(() =>
  [
    ['存活探针', container.value?.livenessProbe],
    ['就绪探针', container.value?.readinessProbe],
    ['启动探针', container.value?.startupProbe],
  ]
    .filter(([, probe]) => Boolean(probe))
    .map(([type, probe]) => ({ type, ...probeDetail(probe as Record<string, any>) })),
)
function resourceValue(key: string) {
  const requests = container.value?.resources?.requests?.[key] || '—'
  const limits = container.value?.resources?.limits?.[key] || '—'
  return `${requests} / ${limits}`
}
async function load() {
  loading.value = true
  try {
    pod.value = await resourceApi.get(definition, { cluster: scope.cluster, namespace: scope.namespace, name: podName.value })
    await loadLogs()
  } finally {
    loading.value = false
  }
}
async function loadLogs() {
  logs.value = formatPodLogs(
    await resourceApi.podLogs(scope.cluster, scope.namespace, podName.value, podLogQuery(containerName.value, 500)),
    true,
  )
}
async function copyLogs() {
  await navigator.clipboard.writeText(logs.value)
  ElMessage.success('日志已复制')
}
onMounted(load)
</script>
<style scoped>
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}
.section-heading h2 {
  font-size: 16px;
}
.section-heading p {
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 12px;
}
.container-grid {
  display: grid;
  grid-template-columns: 0.7fr 1.3fr;
  gap: 24px;
  margin-top: 28px;
}
.command-block {
  margin-top: 24px;
}
.command-block h3 {
  margin-bottom: 10px;
  font-size: 14px;
}
.command-block pre {
  margin: 0;
  padding: 12px 14px;
  overflow: auto;
  color: var(--text-primary);
  background: var(--surface-muted);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  font-size: 12px;
  white-space: pre-wrap;
}
.container-grid h3 {
  margin-bottom: 12px;
  font-size: 14px;
}
.log-section {
  padding: 22px;
}
.log-section pre {
  min-height: 300px;
  max-height: 520px;
  margin: 0;
  padding: 18px;
  overflow: auto;
  color: #e4e7ec;
  background: #101828;
  border-radius: 9px;
  font-size: 12px;
  line-height: 1.7;
  white-space: pre-wrap;
}
@media (max-width: 800px) {
  .container-grid {
    grid-template-columns: 1fr;
  }
}
</style>
