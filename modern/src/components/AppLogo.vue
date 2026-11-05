<template>
  <span class="app-logo" :class="{ 'app-logo--compact': compact }">
    <span class="app-logo__mark" aria-hidden="true"><span>K</span></span>
    <span v-if="!compact" class="app-logo__text">{{ brand }}<small>KUBERNETES CONSOLE</small></span>
  </span>
</template>
<script setup lang="ts">
defineProps<{ compact?: boolean }>()
const brand = import.meta.env.VITE_BRAND_NAME || 'KubeCube'
</script>
<style scoped>
.app-logo {
  display: inline-flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
}
.app-logo__mark {
  display: grid;
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  color: #fff;
  background: linear-gradient(145deg, #7180ff, #4656d9);
  border: 1px solid rgb(255 255 255 / 20%);
  border-radius: 10px;
  box-shadow: 0 5px 14px rgb(0 0 0 / 16%);
  place-items: center;
  font-size: 19px;
  font-weight: 700;
}
.app-logo__text {
  display: flex;
  color: #fff;
  flex-direction: column;
  font-size: 18px;
  font-weight: 650;
  line-height: 22px;
  letter-spacing: -0.025em;
}
.app-logo__text small {
  color: #98a2b3;
  font-size: 8px;
  font-weight: 500;
  line-height: 12px;
  letter-spacing: 0.13em;
}
</style>
