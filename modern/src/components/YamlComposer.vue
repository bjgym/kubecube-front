<template>
  <el-dialog
    v-model="ui.yamlComposerOpen"
    title="YAML 编排"
    width="min(1120px, 96vw)"
    top="4vh"
    :close-on-click-modal="false"
    class="composer-dialog"
    @open="reset"
  >
    <div class="composer-intro">
      <div>
        <h3>从声明到集群，一步完成</h3>
        <p>
          支持多文档 YAML。部署到 <strong>{{ scope.cluster || '未选择集群' }}</strong> /
          <strong>{{ scope.namespace || '未选择空间' }}</strong
          >。
        </p>
      </div>
      <div class="composer-actions">
        <el-button :icon="DocumentAdd" @click="openImport">从已有资源导入</el-button
        ><el-upload accept=".yaml,.yml" :show-file-list="false" :auto-upload="false" :on-change="upload"
          ><el-button :icon="Upload">导入文件</el-button></el-upload
        >
      </div>
    </div>
    <CodeEditor v-model="content" height="min(54vh, 580px)" />
    <div class="composer-status">
      <span>{{ documentCount }} 个资源文档</span
      ><span v-if="validated" class="success"
        ><el-icon><CircleCheck /></el-icon>预检测通过，可以部署</span
      >
    </div>
    <el-alert v-if="error" type="error" :title="error" :closable="false" show-icon />
    <el-dialog v-model="importOpen" title="从已有资源导入" width="min(560px, 94vw)" append-to-body :close-on-click-modal="false">
      <p class="import-description">选择一个当前空间中的资源，将其完整 YAML 载入编辑器。导入会替换当前编辑缓冲区内容。</p>
      <el-form label-position="top">
        <el-form-item label="资源类型">
          <el-select v-model="importKind" filterable class="import-select" @change="loadImportOptions">
            <el-option v-for="item in importableConfigs" :key="item.key" :label="item.title" :value="item.key" />
          </el-select>
        </el-form-item>
        <el-form-item label="资源实例">
          <el-select
            v-model="importName"
            filterable
            :loading="importLoading"
            :disabled="!importOptions.length"
            placeholder="选择要导入的实例"
            class="import-select"
          >
            <el-option v-for="item in importOptions" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
      </el-form>
      <el-alert v-if="importError" type="error" :title="importError" :closable="false" show-icon />
      <el-empty v-else-if="!importLoading && !importOptions.length" description="当前空间没有可导入的资源" :image-size="72" />
      <template #footer
        ><el-button @click="importOpen = false">取消</el-button
        ><el-button type="primary" :disabled="!importName" :loading="importLoading" @click="importResource"
          >导入到编辑器</el-button
        ></template
      >
    </el-dialog>
    <template #footer
      ><el-button @click="ui.yamlComposerOpen = false">取消</el-button
      ><el-button :loading="checking" :disabled="!scope.cluster" @click="dryRun">预检测</el-button
      ><el-button type="primary" :loading="deploying" :disabled="!scope.cluster" @click="deploy">开始部署</el-button></template
    >
  </el-dialog>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { CircleCheck, DocumentAdd, Upload } from '@element-plus/icons-vue'
import { parseAllDocuments } from 'yaml'
import type { UploadFile } from 'element-plus'
import CodeEditor from './CodeEditor.vue'
import { resourceApi } from '@/api/resource'
import { getResourceConfig, resourceConfigs } from '@/config/resources'
import { useScopeStore } from '@/stores/scope'
import { useUiStore } from '@/stores/ui'
import { toYAML } from '@/utils/yaml'
const ui = useUiStore()
const scope = useScopeStore()
const initial = toYAML({
  apiVersion: 'v1',
  kind: 'ConfigMap',
  metadata: { name: 'app-config', namespace: scope.namespace || 'default' },
  data: { 'app.properties': 'env=production\nlogLevel=info' },
})
const content = ref(initial)
const checking = ref(false)
const deploying = ref(false)
const validated = ref(false)
const error = ref('')
const importOpen = ref(false)
const importKind = ref('configmaps')
const importName = ref('')
const importOptions = ref<string[]>([])
const importLoading = ref(false)
const importError = ref('')
const importableConfigs = computed(() => resourceConfigs.filter((config) => config.namespaced))
const documentCount = computed(() => parseAllDocuments(content.value).filter((doc) => doc.contents).length)
function contextFor(configKey: string) {
  const config = getResourceConfig(configKey)
  const projectNamespace = String((scope.currentProject?.spec as Record<string, unknown> | undefined)?.namespace || '')
  return {
    cluster: scope.cluster,
    namespace: ['PrometheusRule', 'AlertmanagerConfig'].includes(config?.key || '') ? projectNamespace || scope.namespace : scope.namespace,
  }
}
async function loadImportOptions() {
  importName.value = ''
  importOptions.value = []
  importError.value = ''
  const config = getResourceConfig(importKind.value)
  if (!config || !scope.cluster || !scope.namespace) {
    importError.value = '请先选择集群与空间'
    return
  }
  importLoading.value = true
  try {
    const response = await resourceApi.list(config, contextFor(importKind.value), { pageNum: 1, pageSize: 200 })
    importOptions.value = (response.items || [])
      .map((item) => item.metadata.name)
      .filter(Boolean)
      .sort()
    if (!importOptions.value.length) importName.value = ''
  } catch (reason) {
    importError.value = reason instanceof Error ? reason.message : '资源列表加载失败'
  } finally {
    importLoading.value = false
  }
}
function openImport() {
  importOpen.value = true
  void loadImportOptions()
}
async function importResource() {
  const config = getResourceConfig(importKind.value)
  if (!config || !importName.value) return
  importLoading.value = true
  importError.value = ''
  try {
    const resource = await resourceApi.get(config, { ...contextFor(importKind.value), name: importName.value })
    content.value = toYAML(resource)
    validated.value = false
    error.value = ''
    importOpen.value = false
    ElMessage.success(`已导入 ${config.shortTitle} ${importName.value}`)
  } catch (reason) {
    importError.value = reason instanceof Error ? reason.message : '资源导入失败，当前 YAML 未修改'
  } finally {
    importLoading.value = false
  }
}
function documents() {
  const docs = parseAllDocuments(content.value)
  const errors = docs.flatMap((doc) => doc.errors)
  if (errors.length) throw new Error(errors[0]?.message || 'YAML 格式不正确')
  const objects = docs.filter((doc) => doc.contents).map((doc) => doc.toJS())
  if (!objects.length) throw new Error('没有可部署的内容')
  return objects
}
async function upload(file: UploadFile) {
  if (!file.raw) return
  content.value = await file.raw.text()
  validated.value = false
}
async function dryRun() {
  checking.value = true
  error.value = ''
  try {
    await resourceApi.deployYaml(scope.cluster, { objects: documents() }, true)
    validated.value = true
    ElMessage.success('预检测通过')
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '预检测失败'
  } finally {
    checking.value = false
  }
}
async function deploy() {
  deploying.value = true
  error.value = ''
  try {
    await resourceApi.deployYaml(scope.cluster, { objects: documents() })
    ElMessage.success('YAML 已成功部署')
    ui.yamlComposerOpen = false
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '部署失败'
  } finally {
    deploying.value = false
  }
}
function reset() {
  validated.value = false
  error.value = ''
}
</script>
<style scoped>
.composer-intro {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}
.composer-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.import-description {
  margin-bottom: 18px;
  color: var(--text-secondary);
  font-size: 13px;
}
.import-select {
  width: 100%;
}
h3 {
  font-size: 15px;
}
p {
  margin-top: 5px;
  color: var(--text-secondary);
  font-size: 12px;
}
.composer-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
  color: var(--text-secondary);
  font-size: 12px;
}
.success {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--success);
}
.el-alert {
  margin-top: 12px;
}
</style>
