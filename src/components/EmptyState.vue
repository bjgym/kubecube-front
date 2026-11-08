<template>
  <div class="empty-state">
    <div class="empty-state__icon" aria-hidden="true">
      <el-icon><Box /></el-icon>
    </div>
    <h3>{{ title }}</h3>
    <p>{{ description }}</p>
    <el-button v-if="actionText" type="primary" @click="$emit('action')">{{ actionText }}</el-button>
  </div>
</template>
<script setup lang="ts">
import { Box } from '@element-plus/icons-vue'
withDefaults(defineProps<{ title?: string; description?: string; actionText?: string }>(), {
  title: '暂无数据',
  description: '当前条件下没有找到相关资源',
})
defineEmits<{ action: [] }>()
</script>
<style scoped>
.empty-state {
  display: flex;
  align-items: center;
  flex-direction: column;
  justify-content: center;
  min-height: 280px;
  padding: 40px 20px;
  text-align: center;
}
.empty-state__icon {
  display: grid;
  width: 56px;
  height: 56px;
  margin-bottom: 18px;
  color: var(--brand-500);
  background: var(--brand-50);
  border-radius: 16px;
  place-items: center;
  font-size: 26px;
}
h3 {
  font-size: 16px;
}
p {
  max-width: 420px;
  margin: 8px 0 20px;
  color: var(--text-secondary);
}
</style>
