import { computed, nextTick, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { resourceApi, type PodLogDetails, type PodLogInfo, type PodLogLine, type PodLogSelection } from '@/api/resource'
import type { KubeResource } from '@/types/api'
import { formatPodLogs, mergeOlderLogs, olderPodLogQuery, podLogQuery } from '@/utils/pod-log'

const LOG_PAGE_SIZE = 100

export interface UsePodLogsOptions {
  cluster: () => string
  namespace: () => string
  pods: () => KubeResource[]
  podOptions: () => string[]
  containerOptions: () => string[]
  active: () => boolean
  viewer: Ref<HTMLElement | undefined>
  openShell: (pod: string, container: string) => void
}

function newerLogQuery(containerName: string, selection: PodLogSelection, previous: boolean) {
  return {
    containerName,
    offsetFrom: selection.offsetTo,
    offsetTo: selection.offsetTo + LOG_PAGE_SIZE,
    referenceTimestamp: selection.referencePoint.timestamp,
    referenceLineNum: selection.referencePoint.lineNum,
    logFilePosition: selection.logFilePosition,
    previous,
  }
}

function mergeNewerLogs(current: PodLogLine[], incoming: PodLogLine[]): PodLogLine[] {
  const seen = new Set(current.map((line) => `${line.timestamp}\u0000${line.content}`))
  return [
    ...current,
    ...incoming.filter((line) => {
      const key = `${line.timestamp}\u0000${line.content}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }),
  ]
}

/**
 * Owns the Pod log reading window: the selected Pod/container, the backend
 * cursor, older/newer paging, the previous-container toggle, the auto-refresh
 * timer and the line merging. The panel only renders the result.
 */
export function usePodLogs(options: UsePodLogsOptions) {
  const pod = ref('')
  const container = ref('')
  const content = ref('')
  const details = ref<PodLogDetails>()
  const loading = ref(false)
  const autoRefresh = ref(false)
  const selection = ref<PodLogSelection>()
  const lines = ref<PodLogLine[]>([])
  const error = ref('')
  const previous = ref(false)
  const info = computed<PodLogInfo | undefined>(() => details.value?.info)
  const lineCount = computed(() => lines.value.length)
  let requestId = 0
  let timer: ReturnType<typeof setInterval> | undefined

  function resetWindow() {
    requestId++
    loading.value = false
    selection.value = undefined
    details.value = undefined
    lines.value = []
    content.value = ''
    error.value = ''
  }

  function clearTimer() {
    clearInterval(timer)
  }

  function startTimer() {
    clearTimer()
    if (autoRefresh.value && options.active()) {
      timer = setInterval(() => {
        if (!loading.value) void loadLogs('newer')
      }, 3000)
    }
  }

  function openShell() {
    if (pod.value) options.openShell(pod.value, container.value || 'app')
  }

  function onPodChange() {
    const current = options.pods().find((item) => item.metadata.name === pod.value)
    container.value = (current?.spec as Record<string, any>)?.containers?.[0]?.name || 'app'
    previous.value = false
    resetWindow()
    void loadLogs()
  }

  function onContainerChange() {
    previous.value = false
    resetWindow()
    void loadLogs()
  }

  function onPreviousChange() {
    resetWindow()
    void loadLogs()
  }

  async function loadLogs(mode: 'latest' | 'older' | 'newer' = 'latest') {
    if (!pod.value) return
    const current = ++requestId
    const podName = pod.value
    const containerName = container.value
    const previousContainer = previous.value
    const currentSelection = selection.value
    const viewer = options.viewer.value
    const distanceFromBottom = viewer ? viewer.scrollHeight - viewer.scrollTop - viewer.clientHeight : 0
    loading.value = true
    error.value = ''
    try {
      const query =
        mode === 'older' && currentSelection
          ? olderPodLogQuery(containerName, currentSelection, LOG_PAGE_SIZE, previousContainer)
          : mode === 'newer' && currentSelection
            ? newerLogQuery(containerName, currentSelection, previousContainer)
            : podLogQuery(containerName, LOG_PAGE_SIZE, previousContainer)
      const response = await resourceApi.podLogs(options.cluster(), options.namespace(), podName, query)
      if (current !== requestId) return
      const merged =
        mode === 'older'
          ? mergeOlderLogs(lines.value, response.logs)
          : mode === 'newer'
            ? mergeNewerLogs(lines.value, response.logs)
            : response.logs
      let nextSelection = response.selection
      if (currentSelection && mode !== 'latest' && (mode !== 'newer' || response.logs.length)) {
        nextSelection = {
          ...response.selection,
          offsetFrom: Math.min(currentSelection.offsetFrom, response.selection.offsetFrom),
          offsetTo: Math.max(currentSelection.offsetTo, response.selection.offsetTo),
        }
      }
      details.value = { ...response, selection: nextSelection, logs: merged }
      selection.value = nextSelection
      lines.value = merged
      content.value = formatPodLogs({ ...response, logs: merged }, true)
    } catch (reason) {
      if (current === requestId)
        error.value = `日志加载失败：${reason instanceof Error ? reason.message : '请求失败，请稍后重试'}。已保留当前日志与读取位置。`
    } finally {
      if (current === requestId) {
        loading.value = false
        await nextTick()
        if (viewer) viewer.scrollTop = Math.max(0, viewer.scrollHeight - viewer.clientHeight - distanceFromBottom)
      }
    }
  }

  async function loadOlderLogs() {
    if (!selection.value || lines.value.length >= 5000) return
    await loadLogs('older')
  }

  async function refreshLatestLogs() {
    await loadLogs(selection.value ? 'newer' : 'latest')
  }

  /**
   * Mirrors the log branch of the parent's related-resource refresh: keep the
   * current Pod when it is still offered, otherwise fall back to the first one,
   * default the container, then read the newest window. The caller decides when
   * the log tab is active; the timer still checks it before starting.
   */
  function syncFromPods() {
    const podOptions = options.podOptions()
    const nextPod = podOptions.includes(pod.value) ? pod.value : podOptions[0] || ''
    if (nextPod !== pod.value) {
      pod.value = nextPod
      resetWindow()
    }
    if (!container.value) container.value = options.containerOptions()[0] || 'app'
    if (pod.value) void loadLogs()
    startTimer()
  }

  function showPod(name: string) {
    pod.value = name
    resetWindow()
  }

  function clearPod() {
    pod.value = ''
  }

  function resetForResourceChange() {
    clearTimer()
    resetWindow()
    pod.value = ''
    container.value = ''
  }

  watch(
    () => options.active(),
    (active) => {
      if (!active) {
        clearTimer()
        resetWindow()
      } else {
        startTimer()
      }
    },
  )
  watch(autoRefresh, startTimer)
  onBeforeUnmount(() => {
    clearTimer()
    requestId++
  })

  return {
    pod,
    container,
    content,
    details,
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
  }
}
