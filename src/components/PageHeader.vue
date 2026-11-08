<template>
  <header class="page-header">
    <div class="page-header__main">
      <el-breadcrumb v-if="breadcrumbs.length" separator="/">
        <el-breadcrumb-item v-for="item in breadcrumbs" :key="item">{{ item }}</el-breadcrumb-item>
      </el-breadcrumb>
      <div class="page-header__title-row">
        <div>
          <h1>{{ title }}</h1>
          <p v-if="description" class="page-header__description">{{ description }}</p>
        </div>
        <slot name="badge" />
      </div>
    </div>
    <div v-if="$slots.actions" class="page-header__actions"><slot name="actions" /></div>
  </header>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ title: string; description?: string; breadcrumbs?: string[] }>(), { breadcrumbs: () => [] })
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  min-height: var(--page-header-min-height);
}
.page-header__main {
  min-width: 0;
}
.page-header__title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 6px;
}
h1 {
  color: var(--text-primary);
  font-size: 24px;
  line-height: 32px;
}
.page-header__description {
  max-width: 760px;
  margin-top: 6px;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 22px;
}
.page-header__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.el-breadcrumb {
  margin-bottom: 4px;
}
@media (max-width: 768px) {
  .page-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 16px;
  }
  .page-header__actions {
    width: 100%;
    flex-wrap: wrap;
  }
  h1 {
    font-size: 22px;
  }
}
</style>
