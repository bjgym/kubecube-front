<template>
  <div class="page page-stack">
    <PageHeader title="操作审计" description="查询平台操作事件、来源与响应状态，并按当前条件导出 CSV。">
      <template #actions
        ><el-button :icon="Download" :loading="exporting" :disabled="loading" @click="exportCsv">导出 CSV</el-button
        ><el-button :icon="Refresh" :loading="loading" @click="loadAudits">刷新</el-button></template
      >
    </PageHeader>

    <section class="surface surface-padded">
      <el-form class="audit-filters" label-position="top" @submit.prevent="search">
        <el-form-item label="账号"
          ><el-input v-model="filters.userName" clearable placeholder="操作用户账号" @keyup.enter="search"
        /></el-form-item>
        <el-form-item label="来源 IP"
          ><el-input v-model="filters.sourceIpAddress" clearable placeholder="例如 10.20.1.30" @keyup.enter="search"
        /></el-form-item>
        <el-form-item label="资源名称"
          ><el-input v-model="filters.resourceName" clearable placeholder="资源名称关键词" @keyup.enter="search"
        /></el-form-item>
        <el-form-item label="事件名称"
          ><el-input v-model="filters.eventName" clearable placeholder="事件名称关键词" @keyup.enter="search"
        /></el-form-item>
        <el-form-item label="响应状态"
          ><el-select v-model="filters.responseStatus" clearable placeholder="全部状态"
            ><el-option v-for="status in statusOptions" :key="status" :label="status" :value="status" /></el-select
        ></el-form-item>
        <el-form-item label="请求时间" class="date-filter"
          ><el-date-picker
            v-model="dateRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            :default-time="defaultTime"
            unlink-panels
        /></el-form-item>
        <div class="filter-actions">
          <el-button @click="resetFilters">重置</el-button
          ><el-button type="primary" :icon="Search" native-type="submit" :loading="loading">查询</el-button>
        </div>
      </el-form>
    </section>

    <el-alert v-if="loadError" :title="loadError" type="error" show-icon :closable="false"
      ><template #default><el-button link type="primary" @click="loadAudits">重新加载</el-button></template></el-alert
    >
    <el-alert v-if="exportError" :title="exportError" type="error" show-icon closable @close="exportError = ''" />

    <section class="surface surface-padded">
      <div class="table-heading">
        <h2>审计事件</h2>
        <span class="text-secondary">共 {{ total }} 条记录，时间按{{ sortAsc ? '升序' : '倒序' }}排列</span>
      </div>
      <el-table v-loading="loading" :data="rows" row-key="eventKey" @sort-change="onSortChange">
        <el-table-column label="账号" min-width="135" fixed="left"
          ><template #default="{ row }">{{ account(row) }}</template></el-table-column
        >
        <el-table-column prop="eventTime" label="时间" width="180" sortable="custom" :sort-orders="['descending', 'ascending', null]"
          ><template #default="{ row }">{{ eventTime(row) }}</template></el-table-column
        >
        <el-table-column label="来源 IP" min-width="135"
          ><template #default="{ row }">{{ text(field(row, 'SourceIpAddress', 'sourceIp')) }}</template></el-table-column
        >
        <el-table-column label="事件名称" min-width="190"
          ><template #default="{ row }"
            ><div>{{ text(field(row, 'EventName', 'eventName', 'action')) }}</div>
            <div class="cell-subtitle">{{ text(field(row, 'RequestMethod', 'requestMethod', 'method')) }}</div></template
          ></el-table-column
        >
        <el-table-column label="资源" min-width="280"
          ><template #default="{ row }"
            ><span class="resource-text">{{ resourceText(row) }}</span></template
          ></el-table-column
        >
        <el-table-column label="状态" width="105"
          ><template #default="{ row }"><StatusTag :status="statusTone(row)" :label="statusLabel(row)" /></template
        ></el-table-column>
        <el-table-column label="请求 ID" min-width="190"
          ><template #default="{ row }"
            ><code class="request-id">{{ text(field(row, 'RequestId', 'requestId', 'id')) }}</code></template
          ></el-table-column
        >
        <template #empty
          ><EmptyState
            v-if="!loading && !loadError"
            title="暂无审计事件"
            description="当前筛选条件下没有审计记录，可调整条件后重新查询。"
            action-text="重置筛选"
            @action="resetFilters"
        /></template>
      </el-table>
      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @size-change="changePageSize"
          @current-change="loadAudits"
        />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { Download, Refresh, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import { auditApi } from '@/api/observability'
import { asText, formatDate } from '@/utils/format'

type AuditEvent = Record<string, unknown>
interface AuditResponse {
  Events?: AuditEvent[]
  Total?: number
  items?: AuditEvent[]
  total?: number
}
const statusOptions = [200, 201, 204, 400, 401, 403, 404, 409, 422, 500, 502, 503]
const defaultTime: [Date, Date] = [new Date(2000, 0, 1, 0, 0, 0), new Date(2000, 0, 1, 23, 59, 59, 999)]
const initialRange = (): [Date, Date] => [new Date(Date.now() - 24 * 60 * 60 * 1000), new Date()]
const filters = reactive({
  userName: '',
  sourceIpAddress: '',
  resourceName: '',
  eventName: '',
  responseStatus: undefined as number | undefined,
})
const dateRange = ref<[Date, Date] | null>(initialRange())
const rows = ref<AuditEvent[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const sortBy = ref('EventTime')
const sortAsc = ref(false)
const loading = ref(false)
const exporting = ref(false)
const loadError = ref('')
const exportError = ref('')
let generation = 0
function errorText(error: unknown) {
  return error instanceof Error ? error.message : '请求失败，请稍后重试'
}
function text(value: unknown) {
  return asText(value)
}
function field(event: AuditEvent, ...keys: string[]) {
  for (const key of keys) if (event[key] !== undefined && event[key] !== null && event[key] !== '') return event[key]
  return undefined
}
function account(event: AuditEvent) {
  const identity = field(event, 'UserIdentity', 'userIdentity') as Record<string, unknown> | undefined
  return text(identity?.AccountId || identity?.accountId || field(event, 'user', 'username'))
}
function eventTime(event: AuditEvent) {
  const epoch = field(event, 'EventTime')
  if (epoch !== undefined && Number.isFinite(Number(epoch))) return formatDate(Number(epoch) * 1000, true)
  return formatDate(field(event, 'timestamp', 'time') as string | number | Date | undefined, true)
}
function resourceText(event: AuditEvent) {
  const reports = field(event, 'ResourceReports')
  if (Array.isArray(reports) && reports.length)
    return reports
      .map((report) => {
        const item = report as Record<string, unknown>
        return [
          item.ResourceType && `类型：${item.ResourceType}`,
          item.ResourceName && `名称：${item.ResourceName}`,
          item.ResourceId && `ID：${item.ResourceId}`,
        ]
          .filter(Boolean)
          .join('，')
      })
      .join('；')
  const type = field(event, 'resourceType')
  const name = field(event, 'resourceName')
  return type || name ? `${text(type)} / ${text(name)}` : '—'
}
function statusCode(event: AuditEvent) {
  const raw = field(event, 'ResponseStatus', 'status')
  return typeof raw === 'number' ? raw : raw !== undefined && /^\d{3}$/.test(String(raw)) ? Number(raw) : undefined
}
function statusTone(event: AuditEvent) {
  const code = statusCode(event)
  if (code !== undefined) return code < 400 ? 'success' : 'failed'
  const raw = String(field(event, 'status') || 'unknown')
  return raw
}
function statusLabel(event: AuditEvent) {
  const code = statusCode(event)
  return code !== undefined ? String(code) : String(field(event, 'status') || '未知')
}
function onSortChange({ order }: { order: 'ascending' | 'descending' | null }) {
  sortAsc.value = order === 'ascending'
  page.value = 1
  void loadAudits()
}
function buildParams(paginated: boolean) {
  const params: Record<string, unknown> = { sortBy: sortBy.value, sortAsc: sortAsc.value }
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== '' && value !== undefined) params[key] = value
  })
  if (dateRange.value) {
    params.startTime = Math.floor(dateRange.value[0].getTime() / 1000)
    params.endTime = Math.floor(dateRange.value[1].getTime() / 1000)
  }
  if (paginated) {
    params.page = page.value
    params.size = pageSize.value
  }
  return params
}
async function loadAudits() {
  const current = ++generation
  loading.value = true
  loadError.value = ''
  try {
    const response = (await auditApi.list(buildParams(true))) as AuditResponse
    if (current !== generation) return
    rows.value = response.Events || response.items || []
    total.value = Number(response.Total ?? response.total ?? rows.value.length) || 0
  } catch (error) {
    if (current === generation) loadError.value = `审计数据加载失败：${errorText(error)}`
  } finally {
    if (current === generation) loading.value = false
  }
}
function search() {
  page.value = 1
  void loadAudits()
}
function resetFilters() {
  Object.assign(filters, { userName: '', sourceIpAddress: '', resourceName: '', eventName: '', responseStatus: undefined })
  dateRange.value = initialRange()
  page.value = 1
  void loadAudits()
}
function changePageSize() {
  page.value = 1
  void loadAudits()
}
function csvCell(value: unknown) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}
function eventsCsv(events: AuditEvent[]) {
  const header = ['事件ID', '账号', '时间', '来源IP', '事件名称', '请求方法', '资源', '响应状态']
  const lines = events.map((event) =>
    [
      field(event, 'RequestId', 'requestId', 'id'),
      account(event),
      eventTime(event),
      field(event, 'SourceIpAddress', 'sourceIp'),
      field(event, 'EventName', 'eventName', 'action'),
      field(event, 'RequestMethod', 'requestMethod', 'method'),
      resourceText(event),
      statusLabel(event),
    ]
      .map(csvCell)
      .join(','),
  )
  return `\uFEFF${header.map(csvCell).join(',')}\r\n${lines.join('\r\n')}`
}
function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
async function exportCsv() {
  exporting.value = true
  exportError.value = ''
  try {
    const response = await auditApi.export(buildParams(false))
    const data = response.data
    let blob: Blob
    if (data instanceof Blob) blob = data
    else if (typeof data === 'string') blob = new Blob([data], { type: 'text/csv;charset=utf-8' })
    else {
      const payload = data as unknown as AuditResponse
      blob = new Blob([eventsCsv(payload.Events || payload.items || [])], { type: 'text/csv;charset=utf-8' })
    }
    const disposition = String(response.headers['content-disposition'] || '')
    const serverName = disposition.match(/filename="?([^";]+)"?/)?.[1]
    download(blob, serverName || `audit-${new Date().toISOString().replaceAll(/[:.]/g, '-')}.csv`)
    ElMessage.success('CSV 已导出')
  } catch (error) {
    exportError.value = `CSV 导出失败：${errorText(error)}`
  } finally {
    exporting.value = false
  }
}
onMounted(loadAudits)
</script>

<style scoped>
.audit-filters {
  display: grid;
  grid-template-columns: repeat(5, minmax(130px, 1fr));
  gap: 4px 14px;
}
.audit-filters .el-select {
  width: 100%;
}
.date-filter {
  grid-column: span 3;
}
.date-filter :deep(.el-form-item__content),
.date-filter :deep(.el-date-editor) {
  width: 100%;
}
.filter-actions {
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  grid-column: span 2;
  padding-bottom: 18px;
}
.table-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}
.table-heading h2 {
  font-size: 17px;
}
.table-heading span {
  font-size: 13px;
}
.cell-subtitle {
  margin-top: 2px;
  color: var(--text-secondary);
  font-size: 12px;
}
.resource-text {
  white-space: normal;
  word-break: break-word;
}
.request-id {
  color: var(--text-secondary);
  font-size: 12px;
}
.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
  overflow-x: auto;
}
@media (max-width: 1250px) {
  .audit-filters {
    grid-template-columns: repeat(3, minmax(140px, 1fr));
  }
  .date-filter {
    grid-column: span 2;
  }
  .filter-actions {
    grid-column: auto;
  }
}
@media (max-width: 760px) {
  .audit-filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .date-filter {
    grid-column: 1 / -1;
  }
  .table-heading {
    align-items: flex-start;
    flex-direction: column;
  }
}
@media (max-width: 520px) {
  .audit-filters {
    grid-template-columns: 1fr;
  }
  .date-filter,
  .filter-actions {
    grid-column: auto;
  }
  .filter-actions {
    justify-content: flex-start;
  }
}
</style>
