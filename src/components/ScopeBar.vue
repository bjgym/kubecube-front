<template>
  <section class="scope-bar" aria-label="当前工作空间上下文">
    <div class="scope-bar__title">
      <el-icon><Collection /></el-icon><span>当前工作空间</span>
    </div>
    <div class="scope-bar__selectors">
      <label class="scope-select"
        ><span>租户</span
        ><el-select v-model="draft.tenant" :loading="scope.loading" placeholder="选择租户" @change="changeTenant"
          ><el-option
            v-for="item in scope.tenants"
            :key="item.metadata.name"
            :label="displayName(item)"
            :value="item.metadata.name" /></el-select
      ></label>
      <span class="scope-separator">/</span>
      <label class="scope-select"
        ><span>项目</span
        ><el-select v-model="draft.project" :disabled="!scope.tenant" placeholder="选择项目" @change="changeProject"
          ><el-option
            v-for="item in scope.projects"
            :key="item.metadata.name"
            :label="displayName(item)"
            :value="item.metadata.name" /></el-select
      ></label>
      <span class="scope-separator">/</span>
      <label class="scope-select scope-select--cluster"
        ><span>集群</span
        ><el-select v-model="draft.cluster" placeholder="选择集群" @change="changeCluster"
          ><el-option
            v-for="item in scope.activeClusters"
            :key="item.clusterName"
            :label="item.clusterDisplayName || item.clusterName"
            :value="item.clusterName"
            ><div class="cluster-option">
              <span>{{ item.clusterDisplayName || item.clusterName }}</span
              ><small>{{ item.isMemberCluster ? '业务集群' : '管控集群' }}</small>
            </div></el-option
          ></el-select
        ></label
      >
      <span class="scope-separator">/</span>
      <label class="scope-select"
        ><span>空间</span
        ><el-select v-model="draft.namespace" :disabled="!scope.cluster" placeholder="选择空间" @change="changeNamespace"
          ><el-option
            v-for="item in scope.namespaces"
            :key="item.metadata.name"
            :label="item.metadata.name"
            :value="item.metadata.name" /></el-select
      ></label>
    </div>
    <button class="scope-mobile-trigger" type="button" aria-label="切换工作空间" @click="mobileOpen = true">
      <el-icon><Collection /></el-icon>
      <span>{{ mobileSummary }}</span>
      <el-icon><ArrowDown /></el-icon>
    </button>
    <el-tooltip content="刷新当前空间资源" placement="top"
      ><button class="refresh-button" type="button" aria-label="刷新空间" :disabled="scope.loading" @click="refresh">
        <el-icon :class="{ spinning: scope.loading }"><Refresh /></el-icon></button
    ></el-tooltip>
  </section>

  <el-drawer v-model="mobileOpen" title="切换工作空间" size="86%" direction="btt">
    <div class="scope-drawer">
      <label class="scope-field"
        ><span>租户</span
        ><el-select v-model="draft.tenant" :loading="scope.loading" placeholder="选择租户" @change="changeTenant"
          ><el-option
            v-for="item in scope.tenants"
            :key="item.metadata.name"
            :label="displayName(item)"
            :value="item.metadata.name" /></el-select
      ></label>
      <label class="scope-field"
        ><span>项目</span
        ><el-select v-model="draft.project" :disabled="!scope.tenant" placeholder="选择项目" @change="changeProject"
          ><el-option
            v-for="item in scope.projects"
            :key="item.metadata.name"
            :label="displayName(item)"
            :value="item.metadata.name" /></el-select
      ></label>
      <label class="scope-field"
        ><span>集群</span
        ><el-select v-model="draft.cluster" placeholder="选择集群" @change="changeCluster"
          ><el-option
            v-for="item in scope.activeClusters"
            :key="item.clusterName"
            :label="item.clusterDisplayName || item.clusterName"
            :value="item.clusterName"
            ><div class="cluster-option">
              <span>{{ item.clusterDisplayName || item.clusterName }}</span
              ><small>{{ item.isMemberCluster ? '业务集群' : '管控集群' }}</small>
            </div></el-option
          ></el-select
        ></label
      >
      <label class="scope-field"
        ><span>空间</span
        ><el-select v-model="draft.namespace" :disabled="!scope.cluster" placeholder="选择空间" @change="changeNamespace"
          ><el-option
            v-for="item in scope.namespaces"
            :key="item.metadata.name"
            :label="item.metadata.name"
            :value="item.metadata.name" /></el-select
      ></label>
    </div>
  </el-drawer>
</template>
<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowDown, Collection, Refresh } from '@element-plus/icons-vue'
import { scopeChangePath, scopeChangeQuery, type ScopeField } from '@/router/scope-transition'
import { useScopeStore } from '@/stores/scope'
import type { KubeResource } from '@/types/api'
const route = useRoute()
const router = useRouter()
const scope = useScopeStore()
const mobileOpen = ref(false)
const draft = reactive({ tenant: scope.tenant, project: scope.project, cluster: scope.cluster, namespace: scope.namespace })
const displayName = (item: KubeResource) => String((item.spec as Record<string, unknown> | undefined)?.displayName || item.metadata.name)
const mobileSummary = computed(() => {
  const cluster = scope.currentCluster?.clusterDisplayName || scope.cluster || '选择集群'
  const namespace = scope.namespace || '选择空间'
  return `${cluster} / ${namespace}`
})
watch(
  () => [scope.tenant, scope.project, scope.cluster, scope.namespace] as const,
  ([tenant, project, cluster, namespace]) => Object.assign(draft, { tenant, project, cluster, namespace }),
  { immediate: true },
)
async function syncQuery() {
  await router.replace({ path: route.path, query: { ...route.query, ...scope.query } })
}
async function applyScopeChange(field: ScopeField, value: string) {
  mobileOpen.value = false
  const target = { path: scopeChangePath(field, route), query: scopeChangeQuery(field, value, scope) }
  try {
    // Apply the scope only after the router guard accepts the navigation. A
    // cancelled dirty-editor prompt must leave both the URL and Pinia untouched.
    const failure = await router.push(target)
    if (failure) syncDraft()
  } catch {
    syncDraft()
  }
}
function syncDraft() {
  Object.assign(draft, { tenant: scope.tenant, project: scope.project, cluster: scope.cluster, namespace: scope.namespace })
}
function changeTenant(value: string) {
  return applyScopeChange('tenant', value)
}
function changeProject(value: string) {
  return applyScopeChange('project', value)
}
function changeCluster(value: string) {
  return applyScopeChange('cluster', value)
}
function changeNamespace(value: string) {
  return applyScopeChange('namespace', value)
}
async function refresh() {
  await scope.initialize(scope.query)
  await syncQuery()
}
</script>
<style scoped>
.scope-bar {
  display: flex;
  min-height: var(--scope-height);
  padding: 8px 24px;
  align-items: center;
  gap: 18px;
  flex-shrink: 0;
  background: #fff;
  border-bottom: 1px solid var(--border-light);
}
.scope-bar__title {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--text-secondary);
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 500;
}
.scope-bar__selectors {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  flex: 1;
}
.scope-mobile-trigger {
  display: none;
  min-width: 0;
  padding: 8px 10px;
  align-items: center;
  gap: 8px;
  flex: 1;
  color: var(--text-regular);
  text-align: left;
  background: var(--surface-subtle);
  border: 1px solid var(--border-light);
  border-radius: 8px;
}
.scope-mobile-trigger > span {
  overflow: hidden;
  flex: 1;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.scope-drawer {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 0 24px;
}
.scope-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.scope-field > span {
  color: var(--text-secondary);
  font-size: 12px;
}
.scope-field :deep(.el-select) {
  width: 100%;
}
.scope-select {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  flex: 1;
}
.scope-select > span {
  color: var(--text-tertiary);
  flex-shrink: 0;
  font-size: 11px;
}
.scope-select :deep(.el-select) {
  width: 100%;
  min-width: 100px;
  max-width: 230px;
}
.scope-select :deep(.el-select__wrapper) {
  min-height: 34px;
  background: var(--surface-subtle);
  box-shadow: 0 0 0 1px var(--border-light) inset;
}
.scope-select--cluster {
  flex: 1.3;
}
.scope-separator {
  color: var(--border-regular);
}
.refresh-button {
  display: grid;
  width: 34px;
  height: 34px;
  padding: 0;
  color: var(--text-secondary);
  background: var(--surface-subtle);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  cursor: pointer;
  place-items: center;
}
.refresh-button:hover {
  color: var(--brand-600);
  border-color: var(--brand-200);
}
.spinning {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.cluster-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.cluster-option small {
  color: var(--text-tertiary);
}
@media (max-width: 1100px) {
  .scope-select > span,
  .scope-separator,
  .scope-bar__title {
    display: none;
  }
}
@media (max-width: 768px) {
  .scope-bar {
    padding: 8px 14px;
    gap: 8px;
  }
  .scope-bar__selectors {
    display: none;
  }
  .scope-mobile-trigger {
    display: flex;
  }
}
</style>
