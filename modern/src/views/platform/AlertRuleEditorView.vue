<template>
  <div class="page page-stack">
    <PageHeader
      :title="isEdit ? '编辑全局告警规则' : '创建全局告警规则'"
      :description="`集群：${cluster} · 命名空间：${namespace}`"
      :breadcrumbs="['平台管理', '全局告警规则', isEdit ? '编辑' : '创建']"
    >
      <template #actions
        ><el-button @click="cancel">返回列表</el-button
        ><el-button v-if="isEdit" :icon="Refresh" :loading="loading" @click="loadRule">重新加载</el-button
        ><el-button type="primary" :loading="submitting" :disabled="!resourceLoaded || loading" @click="submit">{{
          isEdit ? '保存修改' : '创建规则'
        }}</el-button></template
      >
    </PageHeader>
    <el-alert v-if="loadError" :title="loadError" type="error" show-icon :closable="false"
      ><template #default><el-button link type="primary" @click="loadRule">重试</el-button></template></el-alert
    >

    <el-skeleton v-if="loading && !resourceLoaded" class="surface editor-skeleton" animated :rows="10" />
    <template v-else-if="resourceLoaded">
      <section class="surface surface-padded basic-section">
        <div>
          <h2>基本信息</h2>
          <p>一个 PrometheusRule 可包含多个规则组，每组支持告警规则与记录规则。</p>
        </div>
        <el-form label-position="top"
          ><el-form-item label="规则资源名称" required
            ><el-input v-model="resourceName" :disabled="isEdit" class="resource-name" placeholder="例如：platform-availability" />
            <div class="field-help">小写字母、数字或中划线；创建后不可修改。</div></el-form-item
          ></el-form
        >
      </section>

      <section class="surface group-nav">
        <span>规则组</span
        ><el-button
          v-for="(group, groupIndex) in groups"
          :key="group.localId"
          :type="groupIndex === activeGroupIndex ? 'primary' : ''"
          @click="activeGroupIndex = groupIndex"
          >{{ groupIndex + 1 }}. {{ group.name || '未命名' }}</el-button
        ><el-button :icon="Plus" @click="addGroup">添加规则组</el-button>
      </section>
      <section class="surface group-card">
        <header class="group-header">
          <div>
            <span class="group-index">规则组 {{ activeGroupIndex + 1 }}</span>
            <h2>{{ activeGroup.name || '未命名规则组' }}</h2>
          </div>
          <el-button type="danger" plain :icon="Delete" :disabled="groups.length === 1" @click="removeGroup(activeGroupIndex)"
            >删除规则组</el-button
          >
        </header>
        <div class="group-fields">
          <el-form label-position="top"
            ><el-form-item label="规则组名称" required
              ><el-input v-model="activeGroup.name" placeholder="例如：availability" /></el-form-item></el-form
          ><el-form label-position="top"
            ><el-form-item label="评估间隔（可选）"><el-input v-model="activeGroup.interval" placeholder="例如：30s" /></el-form-item
          ></el-form>
        </div>
        <div class="rules-heading">
          <h3>规则（{{ activeGroup.rules.length }}）</h3>
          <el-button :icon="Plus" @click="addRule(activeGroup)">添加规则</el-button>
        </div>
        <div class="rule-nav">
          <el-button
            v-for="(rule, ruleIndex) in activeGroup.rules"
            :key="rule.localId"
            :type="ruleIndex === activeRuleIndex ? 'primary' : ''"
            @click="activeRuleIndex = ruleIndex"
            >{{ ruleIndex + 1 }}. {{ rule.name || '未命名规则' }}</el-button
          >
        </div>
        <article class="rule-card">
          <header>
            <strong>规则 {{ activeRuleIndex + 1 }}</strong
            ><el-button
              link
              type="danger"
              :icon="Delete"
              :disabled="activeGroup.rules.length === 1"
              @click="removeRule(activeGroup, activeRuleIndex)"
              >移除</el-button
            >
          </header>
          <div class="rule-basic">
            <el-form label-position="top"
              ><el-form-item label="规则类型"
                ><el-radio-group v-model="activeRule.kind"
                  ><el-radio-button value="alert">告警规则</el-radio-button
                  ><el-radio-button value="record">记录规则</el-radio-button></el-radio-group
                ></el-form-item
              ></el-form
            ><el-form label-position="top"
              ><el-form-item :label="activeRule.kind === 'alert' ? '告警名称（alert）' : '指标名称（record）'" required
                ><el-input
                  v-model="activeRule.name"
                  :placeholder="
                    activeRule.kind === 'alert' ? '例如：HighErrorRate' : '例如：job:http_requests:rate5m'
                  " /></el-form-item></el-form
            ><el-form v-if="activeRule.kind === 'alert'" label-position="top"
              ><el-form-item label="持续时间（for）"
                ><el-input v-model="activeRule.duration" placeholder="例如：5m" /></el-form-item></el-form
            ><el-form v-if="activeRule.kind === 'alert'" label-position="top"
              ><el-form-item label="告警级别"
                ><el-select v-model="activeRule.severity"
                  ><el-option label="轻微（info）" value="info" /><el-option label="一般（warning）" value="warning" /><el-option
                    label="紧急（critical）"
                    value="critical" /></el-select></el-form-item
            ></el-form>
          </div>
          <div class="expression-form">
            <label class="expression-label">PromQL 表达式（必填）</label
            ><el-input v-model="activeRule.expr" type="textarea" :rows="4" class="mono" placeholder="请输入 PromQL 表达式" />
          </div>
          <div class="annotation-fields">
            <el-form label-position="top"
              ><el-form-item label="摘要（summary，仅告警）"
                ><el-input v-model="activeRule.summary" type="textarea" :rows="2" /></el-form-item></el-form
            ><el-form label-position="top"
              ><el-form-item label="描述（description，仅告警）"
                ><el-input v-model="activeRule.description" type="textarea" :rows="2" /></el-form-item></el-form
            ><el-form label-position="top"
              ><el-form-item label="Runbook URL（仅告警）"
                ><el-input v-model="activeRule.runbookUrl" placeholder="https://..." /></el-form-item
            ></el-form>
          </div>
          <el-form label-position="top" class="kv-form"
            ><el-form-item label="额外 Labels（每行一个 key=value）"
              ><el-input
                :model-value="entriesText(activeRule.labels)"
                type="textarea"
                :rows="3"
                class="mono"
                placeholder="team=platform"
                @update:model-value="updateEntries(activeRule.labels, $event)" /></el-form-item
          ></el-form>
          <el-form v-if="activeRule.kind === 'alert'" label-position="top" class="kv-form"
            ><el-form-item label="额外 Annotations（每行一个 key=value）"
              ><el-input
                :model-value="entriesText(activeRule.annotations)"
                type="textarea"
                :rows="3"
                class="mono"
                placeholder="owner=platform"
                @update:model-value="updateEntries(activeRule.annotations, $event)" /></el-form-item
          ></el-form>
        </article>
        <el-button class="add-rule-bottom" :icon="Plus" @click="addRule(activeGroup)">添加规则</el-button>
      </section>
    </template>
    <EmptyState v-else-if="!loading" title="规则配置不可用" description="请根据上方错误信息重试，或返回规则列表。" />
    <el-alert v-if="submitError" :title="submitError" type="error" show-icon :closable="false" />
    <footer v-if="resourceLoaded" class="editor-footer">
      <el-button @click="cancel">取消</el-button
      ><el-button type="primary" :loading="submitting" :disabled="loading" @click="submit">{{
        isEdit ? '保存修改' : '创建规则'
      }}</el-button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Delete, Plus, Refresh } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { resourceApi, type ResourceDefinition } from '@/api/resource'

interface KeyValue {
  key: string
  value: string
}
interface EditRule {
  localId: number
  kind: 'alert' | 'record'
  name: string
  expr: string
  duration: string
  severity: string
  summary: string
  description: string
  runbookUrl: string
  labels: KeyValue[]
  annotations: KeyValue[]
  raw: Record<string, unknown>
}
interface EditGroup {
  localId: number
  name: string
  interval: string
  rules: EditRule[]
  raw: Record<string, unknown>
}
interface RawRule {
  alert?: string
  record?: string
  expr?: string
  for?: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
  [key: string]: unknown
}
interface RawGroup {
  name?: string
  interval?: string
  rules?: RawRule[]
  [key: string]: unknown
}
const namespace = 'kubecube-monitoring'
const definition: ResourceDefinition = {
  plural: 'prometheusrules',
  kind: 'PrometheusRule',
  group: 'monitoring.coreos.com',
  version: 'v1',
  namespaced: true,
}
let localId = 0
const nextId = () => ++localId
const emptyRule = (): EditRule => ({
  localId: nextId(),
  kind: 'alert',
  name: '',
  expr: '',
  duration: '',
  severity: 'info',
  summary: '',
  description: '',
  runbookUrl: '',
  labels: [],
  annotations: [],
  raw: {},
})
const emptyGroup = (): EditGroup => ({ localId: nextId(), name: '', interval: '', rules: [emptyRule()], raw: {} })
const route = useRoute()
const router = useRouter()
const cluster = computed(() => String(route.params.cluster || ''))
const instance = computed(() => String(route.params.instance || ''))
const isEdit = computed(() => Boolean(instance.value))
const resourceName = ref('')
const groups = ref<EditGroup[]>([emptyGroup()])
const activeGroupIndex = ref(0)
const activeRuleIndex = ref(0)
const activeGroup = computed<EditGroup>(() => groups.value[activeGroupIndex.value] || groups.value[0] || emptyGroup())
const activeRule = computed<EditRule>(() => activeGroup.value.rules[activeRuleIndex.value] || activeGroup.value.rules[0] || emptyRule())
const loading = ref(false)
const submitting = ref(false)
const resourceLoaded = ref(true)
const loadError = ref('')
const submitError = ref('')
let generation = 0
function errorText(error: unknown) {
  return error instanceof Error ? error.message : '请求失败，请稍后重试'
}
function entries(value?: Record<string, string>, excluded: string[] = []) {
  return Object.entries(value || {})
    .filter(([key]) => !excluded.includes(key))
    .map(([key, entryValue]) => ({ key, value: entryValue }))
}
function entriesText(items: KeyValue[]) {
  return items.map((item) => `${item.key}=${item.value}`).join('\n')
}
function updateEntries(items: KeyValue[], value: string) {
  items.splice(
    0,
    items.length,
    ...value
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        const index = line.indexOf('=')
        return { key: index < 0 ? line.trim() : line.slice(0, index).trim(), value: index < 0 ? '' : line.slice(index + 1) }
      }),
  )
}
function resetModel() {
  resourceName.value = ''
  groups.value = [emptyGroup()]
  activeGroupIndex.value = 0
  activeRuleIndex.value = 0
  resourceLoaded.value = !isEdit.value
  loadError.value = ''
  submitError.value = ''
}
async function loadRule() {
  if (!isEdit.value || !cluster.value || !instance.value) return
  const current = ++generation
  loading.value = true
  loadError.value = ''
  try {
    const response = await resourceApi.get(definition, { cluster: cluster.value, namespace, name: instance.value })
    if (current !== generation) return
    resourceName.value = response.metadata.name
    const spec = response.spec as Record<string, unknown> | undefined
    const rawGroups = (spec?.groups as RawGroup[] | undefined) || []
    groups.value = rawGroups.length
      ? rawGroups.map((group) => ({
          localId: nextId(),
          name: group.name || '',
          interval: group.interval || '',
          raw: { ...group },
          rules: (group.rules || []).map((rule) => ({
            localId: nextId(),
            kind: rule.record ? 'record' : 'alert',
            name: rule.alert || rule.record || '',
            expr: rule.expr || '',
            duration: rule.for || '',
            severity: rule.labels?.severity || 'info',
            summary: rule.annotations?.summary || '',
            description: rule.annotations?.description || '',
            runbookUrl: rule.annotations?.runbook_url || '',
            labels: entries(rule.labels, ['severity']),
            annotations: entries(rule.annotations, ['summary', 'description', 'runbook_url']),
            raw: { ...rule },
          })),
        }))
      : [emptyGroup()]
    groups.value.forEach((group) => {
      if (!group.rules.length) group.rules.push(emptyRule())
    })
    activeGroupIndex.value = 0
    activeRuleIndex.value = 0
    resourceLoaded.value = true
  } catch (error) {
    if (current === generation) loadError.value = `告警规则读取失败：${errorText(error)}`
  } finally {
    if (current === generation) loading.value = false
  }
}
function addGroup() {
  groups.value.push(emptyGroup())
  activeGroupIndex.value = groups.value.length - 1
}
function removeGroup(index: number) {
  if (groups.value.length > 1) {
    groups.value.splice(index, 1)
    activeGroupIndex.value = Math.max(0, Math.min(activeGroupIndex.value, groups.value.length - 1))
    activeRuleIndex.value = 0
  }
}
function addRule(group: EditGroup) {
  group.rules.push(emptyRule())
  activeRuleIndex.value = group.rules.length - 1
}
function removeRule(group: EditGroup, index: number) {
  if (group.rules.length > 1) {
    group.rules.splice(index, 1)
    activeRuleIndex.value = Math.max(0, Math.min(activeRuleIndex.value, group.rules.length - 1))
  }
}
function cleanEntries(items: KeyValue[], title: string) {
  const usable = items.filter((item) => item.key.trim() || item.value)
  if (usable.some((item) => !item.key.trim())) throw new Error(`${title}存在未填写键的条目`)
  const keys = usable.map((item) => item.key.trim())
  if (new Set(keys).size !== keys.length) throw new Error(`${title}的键不能重复`)
  return Object.fromEntries(usable.map((item) => [item.key.trim(), item.value]))
}
function validateModel() {
  if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(resourceName.value)) throw new Error('请输入合法的规则资源名称')
  if (!groups.value.length) throw new Error('至少保留一个规则组')
  const groupNames = groups.value.map((group) => group.name.trim())
  if (groupNames.some((name) => !name)) throw new Error('规则组名称不能为空')
  if (new Set(groupNames).size !== groupNames.length) throw new Error('规则组名称不能重复')
  groups.value.forEach((group) => {
    if (!group.rules.length) throw new Error(`规则组“${group.name}”至少需要一条规则`)
    const names = group.rules.map((rule) => rule.name.trim())
    if (names.some((name) => !name)) throw new Error(`规则组“${group.name}”存在未命名规则`)
    if (new Set(names).size !== names.length) throw new Error(`规则组“${group.name}”中的规则名称不能重复`)
    group.rules.forEach((rule) => {
      if (!rule.expr.trim()) throw new Error(`规则“${rule.name}”的 PromQL 不能为空`)
      cleanEntries(rule.labels, `规则“${rule.name}”的 Labels`)
      cleanEntries(rule.annotations, `规则“${rule.name}”的 Annotations`)
    })
  })
}
function buildGroups() {
  return groups.value.map((group) => {
    const groupRest = { ...group.raw }
    delete groupRest.name
    delete groupRest.interval
    delete groupRest.rules
    return {
      ...groupRest,
      name: group.name.trim(),
      ...(group.interval.trim() ? { interval: group.interval.trim() } : {}),
      rules: group.rules.map((rule) => {
        const rest = { ...rule.raw }
        delete rest.alert
        delete rest.record
        delete rest.expr
        delete rest.for
        delete rest.labels
        delete rest.annotations
        const labels = cleanEntries(rule.labels, `规则“${rule.name}”的 Labels`)
        const annotations = cleanEntries(rule.annotations, `规则“${rule.name}”的 Annotations`)
        if (rule.kind === 'alert') {
          labels.severity = rule.severity
          if (rule.summary) annotations.summary = rule.summary
          if (rule.description) annotations.description = rule.description
          if (rule.runbookUrl) annotations.runbook_url = rule.runbookUrl
        }
        return {
          ...rest,
          [rule.kind]: rule.name.trim(),
          expr: rule.expr.trim(),
          ...(rule.kind === 'alert' && rule.duration.trim() ? { for: rule.duration.trim() } : {}),
          ...(Object.keys(labels).length ? { labels } : {}),
          ...(rule.kind === 'alert' && Object.keys(annotations).length ? { annotations } : {}),
        }
      }),
    }
  })
}
async function submit() {
  submitError.value = ''
  try {
    validateModel()
  } catch (error) {
    submitError.value = errorText(error)
    return
  }
  submitting.value = true
  try {
    const spec = { groups: buildGroups() }
    if (isEdit.value) await resourceApi.patch(definition, { cluster: cluster.value, namespace, name: instance.value }, { spec }, 'merge')
    else
      await resourceApi.create(
        definition,
        { cluster: cluster.value, namespace },
        {
          apiVersion: 'monitoring.coreos.com/v1',
          kind: 'PrometheusRule',
          metadata: { name: resourceName.value, namespace, labels: { 'kubecube.io/owner': 'platform' } },
          spec,
        },
      )
    ElMessage.success(isEdit.value ? '告警规则已更新' : '告警规则已创建')
    await router.push({ path: '/platform/PrometheusRule/list', query: { cluster: cluster.value } })
  } catch (error) {
    submitError.value = errorText(error)
  } finally {
    submitting.value = false
  }
}
function cancel() {
  router.push({ path: '/platform/PrometheusRule/list', query: { cluster: cluster.value } })
}
watch(activeGroupIndex, () => {
  activeRuleIndex.value = 0
})
watch(
  [cluster, instance],
  () => {
    resetModel()
    if (isEdit.value) void loadRule()
  },
  { immediate: true },
)
</script>

<style scoped>
.editor-skeleton {
  padding: 28px;
}
.basic-section {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(300px, 1.5fr);
  gap: 32px;
}
.basic-section h2,
.group-header h2 {
  font-size: 17px;
}
.basic-section p {
  margin-top: 6px;
  color: var(--text-secondary);
  font-size: 13px;
}
.resource-name {
  max-width: 520px;
}
.field-help {
  margin-top: 6px;
  color: var(--text-secondary);
  font-size: 12px;
}
.group-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 14px 18px;
}
.group-nav > span {
  margin-right: 4px;
  color: var(--text-secondary);
}
.group-card {
  padding: 24px;
}
.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}
.group-index {
  display: block;
  margin-bottom: 3px;
  color: var(--brand-600);
  font-size: 12px;
}
.group-fields {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 16px;
}
.rules-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 4px 0 14px;
}
.rules-heading h3 {
  font-size: 14px;
}
.rule-nav {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.rule-card {
  margin-bottom: 16px;
  padding: 20px;
  background: var(--surface-subtle);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
}
.rule-card > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.rule-basic {
  display: grid;
  grid-template-columns: 0.8fr 1.4fr 1fr 1fr;
  gap: 14px;
}
.rule-basic .el-select {
  width: 100%;
}
.expression-form {
  margin-top: -4px;
}
.expression-label {
  display: block;
  margin-bottom: 8px;
  color: var(--text-regular);
  font-size: 14px;
}
.kv-form {
  margin-top: 4px;
}
.annotation-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.add-rule-bottom {
  width: 100%;
  border-style: dashed;
}
.editor-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-bottom: 20px;
}
@media (max-width: 1050px) {
  .rule-basic {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 720px) {
  .basic-section,
  .group-fields,
  .annotation-fields {
    grid-template-columns: 1fr;
    gap: 4px;
  }
  .group-card {
    padding: 16px;
  }
  .group-header {
    align-items: flex-start;
    flex-direction: column;
  }
  .rule-basic {
    grid-template-columns: 1fr;
  }
}
</style>
