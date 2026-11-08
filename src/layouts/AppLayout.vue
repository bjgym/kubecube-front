<template>
  <div class="app-shell">
    <AppSidebar v-if="showSidebar" v-show="!isMobile || ui.mobileSidebarOpen" :collapsed="ui.sidebarCollapsed && !isMobile" />
    <button
      v-if="isMobile && ui.mobileSidebarOpen && showSidebar"
      class="sidebar-backdrop"
      aria-label="关闭导航"
      @click="ui.mobileSidebarOpen = false"
    />
    <section class="app-shell__main" :class="{ 'app-shell__main--wide': !showSidebar }">
      <AppHeader :mobile="isMobile && showSidebar" @toggle="ui.toggleSidebar" />
      <ScopeBar v-if="showScope" />
      <main class="app-content" :class="{ 'app-content--namespace': route.name === 'namespace' }">
        <div v-if="scope.loading && !scope.initialized && showScope" class="initial-loading"><el-skeleton :rows="8" animated /></div>
        <router-view v-else v-slot="{ Component }"
          ><transition name="fade" mode="out-in"><component :is="Component" /></transition
        ></router-view>
      </main>
    </section>
    <YamlComposer />
    <CloudShellDrawer />
  </div>
</template>
<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import AppSidebar from '@/components/AppSidebar.vue'
import ScopeBar from '@/components/ScopeBar.vue'
const YamlComposer = defineAsyncComponent(() => import('@/components/YamlComposer.vue'))
const CloudShellDrawer = defineAsyncComponent(() => import('@/components/CloudShellDrawer.vue'))
import { useScopeStore } from '@/stores/scope'
import { useUiStore } from '@/stores/ui'
import { useViewport } from '@/composables/useViewport'
import { pickScopeQuery } from '@/router/scope-query'
const route = useRoute()
const router = useRouter()
const scope = useScopeStore()
const ui = useUiStore()
const { isTablet: isMobile } = useViewport()
// The workspace landing page is still part of the resource console; keep the
// same navigation as every other console page so the sidebar does not vanish
// when a user switches here from the platform area.
const showSidebar = computed(() => true)
const showScope = computed(() => route.path.startsWith('/control') || route.name === 'namespace')
async function syncScopeFromRoute() {
  if (!showScope.value) return
  await scope.applyRouteScope(pickScopeQuery(route.query) as never)
  if (!route.path.startsWith('/control')) return
  const query = { ...route.query, ...scope.query }
  const keys = ['tenant', 'project', 'cluster', 'namespace'] as const
  if (keys.some((key) => String(query[key] || '') !== String(scope[key] || ''))) {
    await router.replace({ path: route.path, query })
  }
}
onMounted(async () => {
  await router.isReady()
  await syncScopeFromRoute()
})
watch(
  () => route.fullPath,
  () => {
    ui.mobileSidebarOpen = false
    void syncScopeFromRoute()
  },
)
</script>
<style scoped>
.app-shell {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--surface-page);
}
.app-shell__main {
  display: flex;
  min-width: 0;
  height: 100%;
  flex: 1;
  flex-direction: column;
}
.app-content {
  min-width: 0;
  padding: var(--content-padding);
  overflow: auto;
  flex: 1;
  scroll-behavior: smooth;
}
.app-content--namespace {
  padding: 0;
}
.initial-loading {
  max-width: 1100px;
  margin: 40px auto;
  padding: 32px;
  background: #fff;
  border-radius: var(--radius-lg);
}
.sidebar-backdrop {
  position: fixed;
  z-index: 1100;
  inset: 0;
  padding: 0;
  background: rgb(16 24 40 / 48%);
  border: 0;
  backdrop-filter: blur(2px);
}
@media (max-width: 1024px) {
  .app-content {
    padding: 22px;
  }
}
@media (max-width: 768px) {
  .app-content {
    padding: 16px;
  }
}
</style>
