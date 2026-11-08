<template>
  <div class="pod-logs-panel">
    <div class="log-toolbar">
      <div class="log-selectors">
        <el-select v-model="pod" placeholder="选择 Pod" @change="onPodChange"
          ><el-option v-for="item in props.podOptions" :key="item" :label="item" :value="item" /></el-select
        ><el-select v-model="container" placeholder="选择容器" @change="onContainerChange"
          ><el-option v-for="item in containerOptions" :key="item" :label="item" :value="item"
        /></el-select>
      </div>
      <div>
        <el-button text :disabled="loading || !selection || lines.length >= 5000" @click="loadOlderLogs">加载更早</el-button
        ><el-button text :disabled="loading" @click="refreshLatestLogs">加载更新</el-button
        ><el-checkbox v-model="previous" :disabled="loading" @change="onPreviousChange">上一容器</el-checkbox
        ><el-checkbox v-model="autoRefresh">自动刷新</el-checkbox
        ><el-button :loading="loading" @click="loadLogs()"
          ><el-icon><Refresh /></el-icon>刷新</el-button
        ><el-button @click="openShell"
          ><el-icon><Monitor /></el-icon>容器终端</el-button
        >
      </div>
    </div>
    <div class="log-viewer">
      <div class="log-viewer__header">
        <span
          ><i :class="{ live: autoRefresh }" />{{
            loading ? '正在读取日志' : `容器 ${info?.containerName || container || '—'} · 已加载 ${lines.length} 行`
          }}</span
        ><span>{{ lineCount }} 行<template v-if="info?.truncated"> · 已达后端读取上限</template></span>
      </div>
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="log-error" />
      <pre ref="logViewer">{{ content || '暂无日志。请选择 Pod 和容器后刷新。' }}</pre>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Monitor, Refresh } from '@element-plus/icons-vue'
import { useUiStore } from '@/stores/ui'
import type { KubeResource } from '@/types/api'
import { usePodLogs } from './usePodLogs'

const props = defineProps<{
  resource?: KubeResource
  instanceName: string
  configKey: string
  scopeKey: string
  cluster: string
  namespace: string
  pods: KubeResource[]
  podOptions: string[]
  active: boolean
}>()

const ui = useUiStore()
const logViewer = ref<HTMLElement>()
const containerOptions = computed(() => {
  const spec = props.resource?.spec as Record<string, any> | undefined
  const containers = (spec?.containers || spec?.template?.spec?.containers || []) as Array<{ name: string }>
  return containers.map((item) => item.name)
})

const logs = usePodLogs({
  cluster: () => props.cluster,
  namespace: () => props.namespace,
  pods: () => props.pods,
  podOptions: () => props.podOptions,
  containerOptions: () => containerOptions.value,
  active: () => props.active,
  viewer: logViewer,
  openShell: (pod, container) => ui.openShell(pod, container),
})

const {
  pod,
  container,
  content,
  info,
  lineCount,
  loading,
  autoRefresh,
  selection,
  lines,
  error,
  previous,
  loadLogs,
  loadOlderLogs,
  refreshLatestLogs,
  onPodChange,
  onContainerChange,
  onPreviousChange,
  openShell,
  syncFromPods,
  showPod,
  clearPod,
  resetWindow,
  resetForResourceChange,
} = logs

watch([() => props.instanceName, () => props.configKey, () => props.scopeKey], () => resetForResourceChange())
onMounted(() => {
  if (props.active) syncFromPods()
})

defineExpose({ showPod, clearPod, resetWindow, syncFromPods })
</script>
<style scoped>
.log-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}
.log-toolbar > div {
  display: flex;
  align-items: center;
  gap: 12px;
}
.log-selectors .el-select {
  width: 220px;
}
.log-viewer {
  overflow: hidden;
  color: #d0d5dd;
  background: #101828;
  border: 1px solid #344054;
  border-radius: 10px;
}
.log-viewer__header {
  display: flex;
  height: 42px;
  padding: 0 16px;
  align-items: center;
  justify-content: space-between;
  color: #98a2b3;
  background: #1d2939;
  font-size: 11px;
}
.log-viewer__header > span:first-child {
  display: flex;
  align-items: center;
  gap: 7px;
}
.log-viewer__header i {
  width: 6px;
  height: 6px;
  background: #667085;
  border-radius: 50%;
}
.log-viewer__header i.live {
  background: var(--success);
  box-shadow: 0 0 0 4px rgb(18 183 106 / 12%);
}
.log-viewer pre {
  min-height: 420px;
  max-height: 62vh;
  margin: 0;
  padding: 18px;
  overflow: auto;
  color: #e4e7ec;
  font-size: 12px;
  line-height: 1.75;
  white-space: pre-wrap;
  word-break: break-all;
}
@media (max-width: 900px) {
  .log-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }
  .log-toolbar > div {
    flex-wrap: wrap;
  }
}
@media (max-width: 600px) {
  .log-selectors {
    flex-direction: column;
  }
  .log-selectors .el-select {
    width: 100%;
  }
}
</style>
