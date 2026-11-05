<template>
  <div class="page page-stack">
    <PageHeader title="全局告警配置" description="管理各集群 Alertmanager 的全局路由、接收人与通知配置。">
      <template #actions
        ><el-select
          v-model="selectedCluster"
          class="cluster-select"
          placeholder="选择集群"
          :loading="clusterLoading"
          @change="changeCluster"
          ><el-option
            v-for="cluster in clusters"
            :key="cluster.clusterName"
            :label="displayName(cluster)"
            :value="cluster.clusterName" /></el-select
        ><el-button :icon="Refresh" :loading="loading" @click="loadConfig">刷新</el-button
        ><el-button type="primary" :loading="saving" :disabled="!selectedCluster || loading" @click="saveConfig"
          >保存配置</el-button
        ></template
      >
    </PageHeader>
    <el-alert v-if="loadError" :title="loadError" type="error" show-icon :closable="false"
      ><template #default><el-button link type="primary" @click="loadConfig">重新加载</el-button></template></el-alert
    >

    <section v-if="selectedCluster" class="surface config-summary">
      <div class="summary-title">
        <div class="config-icon">
          <el-icon><Bell /></el-icon>
        </div>
        <div>
          <h2>Alertmanager 主配置</h2>
          <p>配置保存在 Secret 的 <code>alertmanager.yaml</code> 键中。</p>
        </div>
      </div>
      <StatusTag :status="secretResource ? 'Active' : 'Unknown'" :label="secretResource ? '已配置' : '未配置（当前为未保存模板）'" />
      <dl>
        <div>
          <dt>集群</dt>
          <dd>{{ selectedCluster }}</dd>
        </div>
        <div>
          <dt>命名空间</dt>
          <dd>
            <code>{{ namespace }}</code>
          </dd>
        </div>
        <div>
          <dt>Secret</dt>
          <dd>
            <code>{{ secretName }}</code>
          </dd>
        </div>
        <div>
          <dt>创建时间</dt>
          <dd>{{ secretResource ? formatDate(secretResource.metadata.creationTimestamp) : '—' }}</dd>
        </div>
      </dl>
    </section>

    <section v-if="selectedCluster" class="surface editor-section">
      <div class="editor-heading">
        <div>
          <h2>告警路由配置</h2>
          <p>结构化编辑路由与接收人，或切换 YAML 编辑完整 Alertmanager 配置。</p>
        </div>
        <div class="editor-actions">
          <el-radio-group v-model="configMode" size="small"
            ><el-radio-button value="structured">结构化</el-radio-button
            ><el-radio-button value="yaml">YAML</el-radio-button></el-radio-group
          ><el-button :disabled="saving || configYaml === originalYaml" @click="restoreConfig">还原已加载内容</el-button
          ><el-button type="danger" plain :disabled="!secretResource || saving" :loading="deleting" @click="deleteConfig"
            >删除配置</el-button
          >
        </div>
      </div>
      <el-skeleton v-if="loading && !originalYaml" animated :rows="12" />
      <template v-else>
        <div v-if="configMode === 'structured'" class="structured-config">
          <el-alert
            title="结构化字段会在保存时合并进当前 YAML；接收人的具体通知渠道仍在 YAML 中维护。"
            type="info"
            :closable="false"
            show-icon
          />
          <div class="form-grid">
            <el-form-item label="默认接收人"
              ><el-select v-model="structured.receiver" placeholder="选择接收人"
                ><el-option v-for="name in receiverNames" :key="name" :label="name" :value="name" /></el-select
            ></el-form-item>
            <el-form-item label="分组键（逗号分隔）"
              ><el-input v-model="structured.groupBy" placeholder="alertname, cluster"
            /></el-form-item>
            <el-form-item label="group_wait"><el-input v-model="structured.groupWait" placeholder="30s" /></el-form-item>
            <el-form-item label="group_interval"><el-input v-model="structured.groupInterval" placeholder="5m" /></el-form-item>
            <el-form-item label="repeat_interval"><el-input v-model="structured.repeatInterval" placeholder="4h" /></el-form-item>
          </div>
          <div class="receiver-heading">
            <div>
              <h3>接收人</h3>
              <p>删除接收人前需先将默认路由切换到其他接收人。</p>
            </div>
            <div class="receiver-add">
              <el-input v-model="newReceiverName" placeholder="新接收人名称" @keyup.enter="addReceiver" /><el-button @click="addReceiver"
                >添加</el-button
              >
            </div>
          </div>
          <div class="receiver-list">
            <el-tag
              v-for="name in receiverNames"
              :key="name"
              :closable="name !== structured.receiver && receiverNames.length > 1"
              effect="plain"
              @close="removeReceiver(name)"
              >{{ name }}</el-tag
            >
            <span v-if="!receiverNames.length" class="text-tertiary">暂无接收人，请先添加。</span>
          </div>
          <el-alert v-if="structuredError" :title="structuredError" type="error" :closable="false" show-icon />
        </div>
        <el-input
          v-else
          v-model="configYaml"
          type="textarea"
          :rows="25"
          class="config-editor mono"
          spellcheck="false"
          resize="vertical"
          aria-label="Alertmanager YAML 配置"
        />
      </template>
      <div class="editor-footer">
        <span class="text-secondary">仅保存到当前所选集群，不会影响其他集群。</span
        ><el-button type="primary" :loading="saving" :disabled="loading" @click="saveConfig">{{
          secretResource ? '保存修改' : '创建配置'
        }}</el-button>
      </div>
    </section>
    <section v-else-if="!clusterLoading" class="surface">
      <EmptyState title="暂无可用集群" description="请先添加集群，再配置全局 Alertmanager。" />
    </section>
    <el-alert v-if="saveError" :title="saveError" type="error" show-icon :closable="false" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Bell, Refresh } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import { clusterApi } from '@/api/cluster'
import { resourceApi, type ResourceDefinition } from '@/api/resource'
import { useScopeStore } from '@/stores/scope'
import type { ClusterInfo, KubeResource } from '@/types/api'
import { formatDate } from '@/utils/format'
import { fromYAML, toYAML, validateYAML } from '@/utils/yaml'

interface AlertmanagerConfig {
  route?: { receiver?: string; [key: string]: unknown }
  receivers?: Array<{ name?: string; [key: string]: unknown }>
  [key: string]: unknown
}
const namespace = 'kubecube-monitoring'
const secretName = 'alertmanager-kubecube-monitoring-alertmanager'
const definition: ResourceDefinition = { plural: 'secrets', kind: 'Secret', version: 'v1', namespaced: true }
const defaultConfig = (): string =>
  toYAML({
    global: { resolve_timeout: '5m' },
    route: {
      receiver: 'platform-default',
      group_by: ['alertname', 'cluster'],
      group_wait: '30s',
      group_interval: '5m',
      repeat_interval: '4h',
    },
    receivers: [{ name: 'platform-default' }],
    templates: [],
  })
const route = useRoute()
const router = useRouter()
const scope = useScopeStore()
const clusters = ref<ClusterInfo[]>([])
const selectedCluster = ref('')
const secretResource = ref<KubeResource>()
const configYaml = ref('')
const originalYaml = ref('')
const clusterLoading = ref(false)
const loading = ref(false)
const saving = ref(false)
const deleting = ref(false)
const loadError = ref('')
const saveError = ref('')
const configMode = ref<'structured' | 'yaml'>('structured')
const structured = reactive({ receiver: '', groupBy: '', groupWait: '', groupInterval: '', repeatInterval: '' })
const receiverNames = ref<string[]>([])
const newReceiverName = ref('')
const structuredError = ref('')
let generation = 0
const selectedClusterInfo = computed(() => clusters.value.find((item) => item.clusterName === selectedCluster.value))
function displayName(cluster: ClusterInfo) {
  return cluster.clusterDisplayName || cluster.annotations?.['cluster.kubecube.io/cn-name'] || cluster.clusterName
}
function errorText(error: unknown) {
  return error instanceof Error ? error.message : '请求失败，请稍后重试'
}
function encodeBase64(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}
function decodeBase64(value: string) {
  const binary = atob(value)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}
async function loadClusters() {
  clusterLoading.value = true
  loadError.value = ''
  try {
    const response = await clusterApi.list({ prune: true })
    clusters.value = response.items || []
    const requested = String(route.query.cluster || '')
    selectedCluster.value = clusters.value.some((item) => item.clusterName === requested)
      ? requested
      : scope.cluster || scope.controlCluster || clusters.value[0]?.clusterName || ''
    if (selectedCluster.value) await loadConfig()
  } catch (error) {
    loadError.value = `集群列表加载失败：${errorText(error)}`
  } finally {
    clusterLoading.value = false
  }
}
async function loadConfig() {
  if (!selectedCluster.value) return
  const current = ++generation
  loading.value = true
  loadError.value = ''
  saveError.value = ''
  try {
    const response = await resourceApi.list(definition, { cluster: selectedCluster.value, namespace }, { pageNum: 1, pageSize: 1000 })
    if (current !== generation) return
    const secret = (response.items || []).find((item) => item.metadata.name === secretName)
    let yaml = defaultConfig()
    if (secret) {
      const encoded = secret.data?.['alertmanager.yaml']
      const stringData = (secret as KubeResource & { stringData?: Record<string, string> }).stringData
      if (encoded) yaml = decodeBase64(encoded)
      else if (stringData?.['alertmanager.yaml']) yaml = stringData['alertmanager.yaml']
      else loadError.value = `Secret“${secretName}”已存在，但缺少 alertmanager.yaml；保存将补充该配置键。`
    }
    secretResource.value = secret
    configYaml.value = yaml
    originalYaml.value = yaml
    loadStructured()
  } catch (error) {
    if (current === generation) loadError.value = `Alertmanager 配置加载失败：${errorText(error)}`
  } finally {
    if (current === generation) loading.value = false
  }
}
function changeCluster() {
  secretResource.value = undefined
  configYaml.value = ''
  originalYaml.value = ''
  saveError.value = ''
  void router.replace({ query: { ...route.query, cluster: selectedCluster.value || undefined } })
  void loadConfig()
}
function loadStructured() {
  structuredError.value = ''
  try {
    const config = fromYAML<AlertmanagerConfig>(configYaml.value)
    const routeConfig = (config.route || {}) as Record<string, unknown>
    structured.receiver = String(routeConfig.receiver || '')
    structured.groupBy = Array.isArray(routeConfig.group_by) ? routeConfig.group_by.join(', ') : ''
    structured.groupWait = String(routeConfig.group_wait || '')
    structured.groupInterval = String(routeConfig.group_interval || '')
    structured.repeatInterval = String(routeConfig.repeat_interval || '')
    receiverNames.value = (config.receivers || []).map((receiver) => String(receiver.name || '')).filter(Boolean)
    if (!structured.receiver) structured.receiver = receiverNames.value[0] || ''
  } catch (error) {
    structuredError.value = `YAML 解析失败，无法切换到结构化编辑：${errorText(error)}`
  }
}
function applyStructured() {
  const config = fromYAML<AlertmanagerConfig>(configYaml.value)
  const routeConfig = (config.route || {}) as Record<string, unknown>
  const names = [...new Set(receiverNames.value.map((name) => name.trim()).filter(Boolean))]
  if (!names.length) throw new Error('至少需要一个接收人')
  if (!names.includes(structured.receiver)) throw new Error('默认接收人必须在接收人列表中')
  config.route = {
    ...routeConfig,
    receiver: structured.receiver,
    group_by: structured.groupBy
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    ...(structured.groupWait.trim() ? { group_wait: structured.groupWait.trim() } : { group_wait: undefined }),
    ...(structured.groupInterval.trim() ? { group_interval: structured.groupInterval.trim() } : { group_interval: undefined }),
    ...(structured.repeatInterval.trim() ? { repeat_interval: structured.repeatInterval.trim() } : { repeat_interval: undefined }),
  }
  const existing = new Map((config.receivers || []).map((receiver) => [String(receiver.name || ''), receiver]))
  config.receivers = names.map((name) => existing.get(name) || { name })
  configYaml.value = toYAML(config)
}
function addReceiver() {
  const name = newReceiverName.value.trim()
  if (!name) return
  if (receiverNames.value.includes(name)) {
    structuredError.value = `接收人“${name}”已存在`
    return
  }
  receiverNames.value = [...receiverNames.value, name]
  newReceiverName.value = ''
  structuredError.value = ''
  if (!structured.receiver) structured.receiver = name
}
function removeReceiver(name: string) {
  if (name === structured.receiver) return
  receiverNames.value = receiverNames.value.filter((item) => item !== name)
}
watch(configMode, (mode) => {
  if (mode === 'structured') loadStructured()
})
function validateConfig() {
  const yamlError = validateYAML(configYaml.value)
  if (yamlError) throw new Error(`YAML 格式不正确：${yamlError}`)
  const config = fromYAML<AlertmanagerConfig>(configYaml.value)
  if (!config.route?.receiver) throw new Error('Alertmanager 配置必须包含 route.receiver')
  if (!Array.isArray(config.receivers) || !config.receivers.length) throw new Error('Alertmanager 配置至少需要一个 receivers 接收人')
  const receiverNames = new Set(config.receivers.map((receiver) => receiver.name).filter(Boolean))
  if (!receiverNames.has(config.route.receiver)) throw new Error(`路由接收人“${config.route.receiver}”不在 receivers 列表中`)
}
async function saveConfig() {
  if (!selectedCluster.value) return
  saveError.value = ''
  try {
    if (configMode.value === 'structured') applyStructured()
    validateConfig()
  } catch (error) {
    saveError.value = errorText(error)
    return
  }
  saving.value = true
  try {
    const encoded = encodeBase64(configYaml.value)
    if (secretResource.value)
      await resourceApi.patch(
        definition,
        { cluster: selectedCluster.value, namespace, name: secretName },
        { data: { 'alertmanager.yaml': encoded } },
        'merge',
      )
    else
      await resourceApi.create(
        definition,
        { cluster: selectedCluster.value, namespace },
        {
          apiVersion: 'v1',
          kind: 'Secret',
          metadata: {
            name: secretName,
            namespace,
            labels: {
              'app.kubernetes.io/managed-by': 'kubecube-console',
              'app.kubernetes.io/name': selectedClusterInfo.value?.clusterName || selectedCluster.value,
            },
          },
          type: 'Opaque',
          data: { 'alertmanager.yaml': encoded },
        },
      )
    ElMessage.success('Alertmanager 配置已保存')
    originalYaml.value = configYaml.value
    await loadConfig()
  } catch (error) {
    saveError.value = errorText(error)
  } finally {
    saving.value = false
  }
}
function restoreConfig() {
  configYaml.value = originalYaml.value
  loadStructured()
  saveError.value = ''
}
async function deleteConfig() {
  if (!secretResource.value) return
  try {
    await ElMessageBox.confirm(
      `确认删除集群“${selectedCluster.value}”的 Alertmanager 主配置吗？此操作会删除 Secret“${secretName}”，告警通知可能立即中断。`,
      '删除全局告警配置',
      { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消', confirmButtonClass: 'el-button--danger' },
    )
  } catch {
    return
  }
  deleting.value = true
  saveError.value = ''
  try {
    await resourceApi.delete(definition, { cluster: selectedCluster.value, namespace, name: secretName })
    ElMessage.success('Alertmanager 配置已删除')
    secretResource.value = undefined
    configYaml.value = defaultConfig()
    originalYaml.value = configYaml.value
    await loadConfig()
  } catch (error) {
    saveError.value = `删除失败：${errorText(error)}`
  } finally {
    deleting.value = false
  }
}
onMounted(loadClusters)
</script>

<style scoped>
.cluster-select {
  width: 210px;
}
.config-summary {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 20px;
  padding: 22px 24px;
}
.summary-title {
  display: flex;
  align-items: center;
  gap: 14px;
}
.summary-title h2 {
  font-size: 17px;
}
.summary-title p {
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 12px;
}
.config-icon {
  display: grid;
  width: 42px;
  height: 42px;
  color: var(--brand-600);
  background: var(--brand-50);
  border-radius: 10px;
  place-items: center;
  font-size: 21px;
}
.config-summary dl {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  grid-column: 1 / -1;
  gap: 16px;
  margin: 0;
  padding-top: 18px;
  border-top: 1px solid var(--border-light);
}
.config-summary dt {
  margin-bottom: 4px;
  color: var(--text-secondary);
  font-size: 12px;
}
.config-summary dd {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.editor-section {
  padding: 24px;
}
.editor-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 18px;
}
.editor-heading h2 {
  font-size: 17px;
}
.editor-heading p {
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 12px;
}
.editor-actions {
  display: flex;
  flex-shrink: 0;
  gap: 10px;
}
.structured-config {
  display: grid;
  gap: 16px;
}
.structured-config .form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 18px;
}
.receiver-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}
.receiver-heading h3 {
  font-size: 14px;
}
.receiver-heading p {
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 12px;
}
.receiver-add {
  display: flex;
  gap: 8px;
  width: min(360px, 100%);
}
.receiver-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.config-editor :deep(textarea) {
  min-height: 480px;
  padding: 16px;
  color: #d1e7ff;
  background: #101828;
  border-color: #344054;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.65;
  tab-size: 2;
}
.editor-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 18px;
}
@media (max-width: 900px) {
  .config-summary dl {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .editor-heading {
    align-items: flex-start;
    flex-direction: column;
  }
}
@media (max-width: 600px) {
  .cluster-select {
    width: 100%;
  }
  .config-summary {
    grid-template-columns: 1fr;
    padding: 18px;
  }
  .config-summary dl {
    grid-template-columns: 1fr;
  }
  .editor-section {
    padding: 16px;
  }
  .editor-actions {
    flex-wrap: wrap;
  }
  .editor-footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
