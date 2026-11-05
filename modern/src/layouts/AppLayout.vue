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
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import AppSidebar from '@/components/AppSidebar.vue'
import ScopeBar from '@/components/ScopeBar.vue'
import YamlComposer from '@/components/YamlComposer.vue'
import CloudShellDrawer from '@/components/CloudShellDrawer.vue'
import { useScopeStore } from '@/stores/scope'
import { useUiStore } from '@/stores/ui'
import { pickScopeQuery } from '@/router/scope-query'
const route = useRoute()
const router = useRouter()
const scope = useScopeStore()
const ui = useUiStore()
const width = ref(window.innerWidth)
const isMobile = computed(() => width.value < 1024)
const showSidebar = computed(() => route.name !== 'namespace')
const showScope = computed(() => route.path.startsWith('/control') || route.name === 'namespace')
const resize = () => {
  width.value = window.innerWidth
}
async function initializeScope() {
  if (!showScope.value) return
  await scope.initialize(pickScopeQuery(route.query) as never)
  if (route.path.startsWith('/control')) await router.replace({ query: { ...route.query, ...scope.query } })
}
onMounted(async () => {
  window.addEventListener('resize', resize)
  await router.isReady()
  if (showScope.value) await initializeScope()
})
onBeforeUnmount(() => window.removeEventListener('resize', resize))
watch(showScope, async (visible) => {
  if (visible && !scope.initialized) await initializeScope()
})
watch(
  () => route.path,
  async (path, previous) => {
    ui.mobileSidebarOpen = false
    if (path.startsWith('/control') && !previous.startsWith('/control')) {
      if (!scope.initialized) await scope.initialize(pickScopeQuery(route.query) as never)
    }
  },
)
watch(
  () => route.fullPath,
  async () => {
    if (!showScope.value || !scope.initialized || scope.loading) return
    const requested = pickScopeQuery(route.query) as Record<string, string | undefined>
    const keys = ['tenant', 'project', 'cluster', 'namespace'] as const
    if (!keys.some((key) => requested[key] && requested[key] !== scope[key])) return
    await scope.initialize(requested as never)
    const query = { ...route.query, ...scope.query }
    if (keys.some((key) => String(query[key] || '') !== String(scope[key] || ''))) {
      await router.replace({ path: route.path, query })
    }
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
  padding: 28px;
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
