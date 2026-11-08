<template><div ref="host" class="code-editor" :style="{ height }" /></template>
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type * as Monaco from 'monaco-editor'

const props = withDefaults(
  defineProps<{ modelValue: string; readOnly?: boolean; height?: string; language?: 'yaml' | 'json' | 'plaintext' }>(),
  { height: '480px', language: 'yaml' },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const host = ref<HTMLElement>()
let editor: Monaco.editor.IStandaloneCodeEditor | undefined
let monaco: typeof Monaco | undefined
let destroyed = false

onMounted(async () => {
  if (!host.value) return
  const element = host.value
  monaco = await import('monaco-editor')
  const workerModule = await import('monaco-editor/editor/editor.worker.js?worker')
  if (destroyed || !host.value || host.value !== element) return
  const EditorWorker = workerModule.default
  self.MonacoEnvironment = { getWorker: () => new EditorWorker() }
  editor = monaco.editor.create(element, {
    value: props.modelValue,
    language: props.language,
    readOnly: props.readOnly,
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 13,
    lineHeight: 21,
    fontFamily: 'SFMono-Regular, Consolas, Liberation Mono, monospace',
    padding: { top: 16, bottom: 16 },
    smoothScrolling: true,
    scrollBeyondLastLine: false,
    renderLineHighlight: 'all',
    overviewRulerBorder: false,
    hideCursorInOverviewRuler: true,
    scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
    theme: 'vs',
  })
  editor.onDidChangeModelContent(() => emit('update:modelValue', editor?.getValue() || ''))
})
watch(
  () => props.modelValue,
  (value) => {
    if (editor && value !== editor.getValue()) editor.setValue(value)
  },
)
watch(
  () => props.readOnly,
  (value) => editor?.updateOptions({ readOnly: value }),
)
watch(
  () => props.language,
  (value) => {
    const model = editor?.getModel()
    if (model && monaco) monaco.editor.setModelLanguage(model, value)
  },
)
onBeforeUnmount(() => {
  destroyed = true
  editor?.dispose()
  editor = undefined
})
</script>
<style scoped>
.code-editor {
  width: 100%;
  min-height: 240px;
  overflow: hidden;
  background: #fff;
  border: 1px solid var(--border-light);
  border-radius: 8px;
}
</style>
