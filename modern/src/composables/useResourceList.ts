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
    load()
  }
  function onPage(page: number) {
    pagination.pageNum = page
    load()
  }
  function onPageSize(size: number) {
    pagination.pageSize = size
    pagination.pageNum = 1
    load()
  }
  function onSort({ prop, order }: { prop: string; order: 'ascending' | 'descending' | null }) {
    pagination.sortName = order ? prop : undefined
    pagination.sortOrder = order === 'ascending' ? 'asc' : 'desc'
    pagination.sortFunc = prop.includes('creationTimestamp') ? 'time' : 'string'
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
