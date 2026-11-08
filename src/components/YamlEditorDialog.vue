<template>
  <el-dialog
    :model-value="modelValue"
    :title="title"
    width="min(1040px, 94vw)"
    :fullscreen="fullscreen"
    :close-on-click-modal="false"
    :before-close="close"
    class="yaml-dialog"
    @open="syncContent"
  >
    <div class="yaml-toolbar">
      <div><el-tag effect="plain" type="info">YAML</el-tag><span v-if="dirty" class="unsaved">有未保存修改</span></div>
      <div class="yaml-toolbar__actions">
        <el-button text @click="copy"
          ><el-icon><CopyDocument /></el-icon>复制</el-button
        >
        <el-button text @click="download"
          ><el-icon><Download /></el-icon>下载</el-button
        >
        <el-button text @click="fullscreen = !fullscreen"
          ><el-icon><FullScreen /></el-icon>{{ fullscreen ? '退出全屏' : '全屏' }}</el-button
        >
      </div>
    </div>
    <CodeEditor v-model="draft" :read-only="readOnly" :height="fullscreen ? 'calc(100vh - 240px)' : 'min(58vh, 620px)'" />
    <el-alert v-if="error" class="yaml-error" type="error" :title="error" :closable="false" show-icon />
    <template #footer>
      <el-button @click="close">关闭</el-button>
      <el-button v-if="!readOnly" type="primary" :loading="submitting" @click="submit">保存并应用</el-button>
    </template>
  </el-dialog>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CopyDocument, Download, FullScreen } from '@element-plus/icons-vue'
import CodeEditor from './CodeEditor.vue'
import { validateYAML } from '@/utils/yaml'
const props = withDefaults(
  defineProps<{ modelValue: boolean; title: string; content: string; readOnly?: boolean; submitting?: boolean }>(),
  { readOnly: false },
)
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; submit: [content: string] }>()
const draft = ref('')
const dirty = ref(false)
const fullscreen = ref(false)
const error = ref('')
watch(
  () => props.content,
  () => {
    if (props.modelValue) syncContent()
  },
)
watch(draft, (value) => {
  if (props.modelValue) dirty.value = value !== props.content
})
function syncContent() {
  draft.value = props.content
  dirty.value = false
  error.value = ''
}
async function close() {
  if (dirty.value && !props.readOnly)
    await ElMessageBox.confirm('关闭后将丢失未保存的 YAML 修改，确定继续吗？', '未保存的修改', {
      type: 'warning',
      confirmButtonText: '放弃修改',
      cancelButtonText: '继续编辑',
    })
  emit('update:modelValue', false)
  fullscreen.value = false
}
async function copy() {
  await navigator.clipboard.writeText(draft.value)
  ElMessage.success('YAML 已复制')
}
function download() {
  const url = URL.createObjectURL(new Blob([draft.value], { type: 'application/yaml' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${props.title.replaceAll(/\s/g, '-') || 'resource'}.yaml`
  link.click()
  URL.revokeObjectURL(url)
}
function submit() {
  error.value = validateYAML(draft.value) || ''
  if (!error.value) emit('submit', draft.value)
}
</script>
<style scoped>
.yaml-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.yaml-toolbar > div {
  display: flex;
  align-items: center;
  gap: 10px;
}
.yaml-toolbar__actions {
  margin-left: auto;
}
.unsaved {
  color: var(--warning);
  font-size: 12px;
}
.yaml-error {
  margin-top: 12px;
}
@media (max-width: 600px) {
  .yaml-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }
  .yaml-toolbar__actions {
    margin-left: 0;
  }
}
</style>
