<template>
  <section class="metric-card surface" :class="`metric-card--${tone}`">
    <div class="metric-card__top">
      <span class="metric-card__label">{{ label }}</span>
      <span v-if="$slots.icon" class="metric-card__icon"><slot name="icon" /></span>
    </div>
    <el-skeleton v-if="loading" :rows="1" animated />
    <template v-else>
      <div class="metric-card__value">
        {{ value }}<span v-if="unit" class="metric-card__unit">{{ unit }}</span>
      </div>
      <div v-if="caption || $slots.default" class="metric-card__caption">
        <slot>{{ caption }}</slot>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    value: string | number
    unit?: string
    caption?: string
    loading?: boolean
    tone?: 'brand' | 'success' | 'warning' | 'info'
  }>(),
  { tone: 'brand' },
)
</script>

<style scoped>
.metric-card {
  position: relative;
  min-width: 0;
  padding: 20px 22px;
  overflow: hidden;
}
.metric-card::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: var(--metric-color);
  content: '';
  opacity: 0.85;
}
.metric-card--brand {
  --metric-color: var(--brand-500);
  --metric-bg: var(--brand-50);
}
.metric-card--success {
  --metric-color: var(--success);
  --metric-bg: #ecfdf3;
}
.metric-card--warning {
  --metric-color: var(--warning);
  --metric-bg: #fffaeb;
}
.metric-card--info {
  --metric-color: var(--info);
  --metric-bg: #eff8ff;
}
.metric-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.metric-card__label {
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
}
.metric-card__icon {
  display: grid;
  width: 36px;
  height: 36px;
  color: var(--metric-color);
  background: var(--metric-bg);
  border-radius: 9px;
  place-items: center;
  font-size: 19px;
}
.metric-card__value {
  margin-top: 10px;
  color: var(--text-primary);
  font-size: 28px;
  font-weight: 650;
  line-height: 36px;
  letter-spacing: -0.035em;
}
.metric-card__unit {
  margin-left: 7px;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0;
}
.metric-card__caption {
  min-height: 20px;
  margin-top: 5px;
  color: var(--text-secondary);
  font-size: 12px;
}
</style>
