<template>
  <span class="status-tag" :class="`status-tag--${tone}`" role="status">
    <span class="status-tag__dot" aria-hidden="true" />
    {{ text }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ status?: string; label?: string }>()
const normalized = computed(() => (props.status || 'unknown').toLowerCase())
const tone = computed(() => {
  if (
    ['running', 'normal', 'active', 'bound', 'success', 'succeeded', 'ready', 'loaded', '已完成', '运行正常', 'true'].some((value) =>
      normalized.value.includes(value),
    )
  )
    return 'success'
  if (['pending', 'processing', 'waiting', 'progressing', 'creating', '执行中', '运行中'].some((value) => normalized.value.includes(value)))
    return 'warning'
  if (['failed', 'failure', 'abnormal', 'error', 'deleting', 'crash', 'unknown', '异常'].some((value) => normalized.value.includes(value)))
    return 'danger'
  return 'neutral'
})
const text = computed(() => props.label || props.status || '未知')
</script>

<style scoped>
.status-tag {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  max-width: 100%;
  min-height: 26px;
  padding: 3px 9px;
  border: 1px solid transparent;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  white-space: nowrap;
}
.status-tag__dot {
  width: 6px;
  height: 6px;
  flex: 0 0 6px;
  border-radius: 50%;
  background: currentColor;
}
.status-tag--success {
  color: #067647;
  background: #ecfdf3;
  border-color: #abefc6;
}
.status-tag--warning {
  color: #b54708;
  background: #fffaeb;
  border-color: #fedf89;
}
.status-tag--danger {
  color: #b42318;
  background: #fef3f2;
  border-color: #fecdca;
}
.status-tag--neutral {
  color: #475467;
  background: #f2f4f7;
  border-color: #e4e7ec;
}
</style>
