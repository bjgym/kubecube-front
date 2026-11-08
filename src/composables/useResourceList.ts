import { computed, reactive, ref, watch, type Ref } from 'vue'
import { resourceApi, type ResourceContext, type ResourceDefinition } from '@/api/resource'
import type { KubeResource, PaginationQuery } from '@/types/api'

export function useResourceList(definition: Ref<ResourceDefinition>, context: Ref<ResourceContext>) {
  const items = ref<KubeResource[]>([])
  const total = ref(0)
  const loading = ref(false)
  const error = ref('')
  const search = ref('')
  const pagination = reactive<PaginationQuery>({
    pageNum: 1,
    pageSize: 10,
    sortName: 'metadata.creationTimestamp',
    sortOrder: 'desc',
    sortFunc: 'time',
  })
  let requestId = 0

  const storageKey = computed(
    () => `kubecube-list:${definition.value.plural}:${context.value.cluster || ''}:${context.value.namespace || ''}`,
  )
  interface SavedListState {
    search: string
    pageNum: number
    pageSize: number
    sortName?: string
    sortOrder?: 'asc' | 'desc'
    sortFunc?: 'time' | 'string'
  }
  function restoreState() {
    try {
      const saved = sessionStorage.getItem(storageKey.value)
      if (!saved) return
      const state = JSON.parse(saved) as Partial<SavedListState>
      if (typeof state.search === 'string') search.value = state.search
      if (Number.isFinite(state.pageNum) && Number(state.pageNum) > 0) pagination.pageNum = Number(state.pageNum)
      if (Number.isFinite(state.pageSize) && Number(state.pageSize) > 0) pagination.pageSize = Number(state.pageSize)
      if (state.sortName !== undefined) pagination.sortName = state.sortName
      if (state.sortOrder === 'asc' || state.sortOrder === 'desc') pagination.sortOrder = state.sortOrder
      if (state.sortFunc === 'time' || state.sortFunc === 'string') pagination.sortFunc = state.sortFunc
    } catch {
      /* ignore unavailable or invalid state */
    }
  }
  function saveState() {
    try {
      const state: SavedListState = {
        search: search.value,
        pageNum: pagination.pageNum,
        pageSize: pagination.pageSize,
        sortName: pagination.sortName,
        sortOrder: pagination.sortOrder,
        sortFunc: pagination.sortFunc,
      }
      sessionStorage.setItem(storageKey.value, JSON.stringify(state))
    } catch {
      /* ignore unavailable storage */
    }
  }
  restoreState()

  const params = computed<Partial<PaginationQuery>>(() => ({
    ...pagination,
    selector: search.value ? `metadata.name~${search.value}` : undefined,
  }))

  async function load() {
    if (!context.value.cluster || (definition.value.namespaced && !context.value.namespace)) {
      items.value = []
      total.value = 0
      return
    }
    const id = ++requestId
    loading.value = true
    error.value = ''
    try {
      const response = await resourceApi.list(definition.value, context.value, params.value)
      if (id !== requestId) return
      items.value = response.items || []
      total.value = response.total ?? items.value.length
      if (!items.value.length && total.value > 0 && pagination.pageNum > 1) {
        pagination.pageNum--
        return
      }
    } catch (reason) {
      if (id !== requestId) return
      error.value = reason instanceof Error ? reason.message : '资源加载失败'
    } finally {
      if (id === requestId) loading.value = false
    }
  }

  function onSearch(value: string) {
    search.value = value
    pagination.pageNum = 1
    saveState()
    load()
  }
  function onPage(page: number) {
    pagination.pageNum = page
    saveState()
    load()
  }
  function onPageSize(size: number) {
    pagination.pageSize = size
    pagination.pageNum = 1
    saveState()
    load()
  }
  function onSort({ prop, order }: { prop: string; order: 'ascending' | 'descending' | null }) {
    pagination.sortName = order ? prop : undefined
    pagination.sortOrder = order === 'ascending' ? 'asc' : 'desc'
    pagination.sortFunc = prop.includes('creationTimestamp') ? 'time' : 'string'
    saveState()
    load()
  }

  watch(
    [() => definition.value.plural, () => context.value.cluster, () => context.value.namespace],
    () => {
      pagination.pageNum = 1
      load()
    },
    { immediate: true },
  )
  return { items, total, loading, error, search, pagination, load, onSearch, onPage, onPageSize, onSort }
}
