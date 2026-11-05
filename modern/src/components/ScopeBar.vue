<template>
  <section class="scope-bar" aria-label="工作空间上下文">
    <div class="scope-bar__title">
      <el-icon><Collection /></el-icon><span>工作空间</span>
    </div>
    <div class="scope-bar__selectors">
      <label class="scope-select"
        ><span>租户</span
        ><el-select :model-value="scope.tenant" :loading="scope.loading" placeholder="选择租户" @change="changeTenant"
          ><el-option
            v-for="item in scope.tenants"
            :key="item.metadata.name"
            :label="displayName(item)"
            :value="item.metadata.name" /></el-select
      ></label>
      <span class="scope-separator">/</span>
      <label class="scope-select"
        ><span>项目</span
        ><el-select :model-value="scope.project" :disabled="!scope.tenant" placeholder="选择项目" @change="changeProject"
          ><el-option
            v-for="item in scope.projects"
            :key="item.metadata.name"
            :label="displayName(item)"
            :value="item.metadata.name" /></el-select
      ></label>
      <span class="scope-separator">/</span>
      <label class="scope-select scope-select--cluster"
        ><span>集群</span
        ><el-select :model-value="scope.cluster" placeholder="选择集群" @change="changeCluster"
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
        ><el-select :model-value="scope.namespace" :disabled="!scope.cluster" placeholder="选择空间" @change="changeNamespace"
          ><el-option
            v-for="item in scope.namespaces"
            :key="item.metadata.name"
            :label="item.metadata.name"
            :value="item.metadata.name" /></el-select
      ></label>
    </div>
    <el-tooltip content="刷新当前空间资源" placement="top"
      ><button class="refresh-button" type="button" aria-label="刷新空间" :disabled="scope.loading" @click="refresh">
        <el-icon :class="{ spinning: scope.loading }"><Refresh /></el-icon></button
    ></el-tooltip>
  </section>
</template>
<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { Collection, Refresh } from '@element-plus/icons-vue'
import { useScopeStore } from '@/stores/scope'
import type { KubeResource } from '@/types/api'
const route = useRoute()
const router = useRouter()
const scope = useScopeStore()
const displayName = (item: KubeResource) => String((item.spec as Record<string, unknown> | undefined)?.displayName || item.metadata.name)
async function syncQuery() {
  await router.replace({ path: route.path, query: { ...route.query, ...scope.query } })
}
async function changeTenant(value: string) {
  await scope.selectTenant(value)
  await router.push({ path: '/namespace', query: scope.query })
}
async function changeProject(value: string) {
  await scope.selectProject(value)
  await router.push({ path: '/namespace', query: scope.query })
}
async function changeCluster(value: string) {
  await scope.selectCluster(value)
  await leaveStaleResource()
  await syncQuery()
}
async function changeNamespace(value: string) {
  await scope.selectNamespace(value)
  await leaveStaleResource()
  await syncQuery()
}
async function leaveStaleResource() {
  const workload = route.params.workload
  if (workload && !route.path.endsWith('/list')) await router.replace({ path: `/control/${String(workload)}/list`, query: scope.query })
}
async function refresh() {
  await scope.initialize(scope.query)
  await syncQuery()
}
</script>
<style scoped>
.scope-bar {
  display: flex;
  min-height: 62px;
  padding: 10px 24px;
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
    padding: 10px 14px;
    overflow-x: auto;
  }
  .scope-bar__selectors {
    min-width: 560px;
  }
  .scope-select :deep(.el-select) {
    max-width: none;
  }
}
</style>
