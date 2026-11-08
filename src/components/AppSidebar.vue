<template>
  <aside class="app-sidebar" :class="{ 'is-collapsed': collapsed }">
    <div class="app-sidebar__brand"><AppLogo :compact="collapsed" /></div>
    <nav class="app-sidebar__areas" aria-label="控制台区域">
      <el-menu :default-active="activeArea" :collapse="collapsed" :collapse-transition="false" @select="onAreaSelect">
        <el-menu-item index="workspace">
          <el-icon><Grid /></el-icon>
          <template #title>工作空间</template>
        </el-menu-item>
        <el-menu-item index="console">
          <el-icon><Odometer /></el-icon>
          <template #title>资源控制台</template>
        </el-menu-item>
        <el-menu-item v-if="canManagePlatform" index="platform">
          <el-icon><SetUp /></el-icon>
          <template #title>运维管理</template>
        </el-menu-item>
      </el-menu>
    </nav>
    <template v-if="visibleItems.length">
      <div class="app-sidebar__caption">{{ isPlatform ? '平台功能' : '资源管理' }}</div>
      <el-scrollbar class="app-sidebar__scroll">
        <nav :aria-label="isPlatform ? '运维管理导航' : '资源控制台导航'">
          <el-menu :default-active="activePath" :collapse="collapsed" :collapse-transition="false" unique-opened @select="onSelect">
            <template v-for="item in visibleItems" :key="item.label">
              <el-sub-menu v-if="item.children" :index="item.label">
                <template #title
                  ><el-icon><component :is="icons[item.icon]" /></el-icon><span>{{ item.label }}</span></template
                >
                <el-menu-item v-for="child in item.children" :key="child.path" :index="child.path">{{ child.label }}</el-menu-item>
              </el-sub-menu>
              <el-menu-item v-else :index="item.action || item.path">
                <el-icon><component :is="icons[item.icon]" /></el-icon>
                <template #title
                  >{{ item.label }}<el-icon v-if="item.action" class="action-icon"><TopRight /></el-icon
                ></template>
              </el-menu-item>
            </template>
          </el-menu>
        </nav>
      </el-scrollbar>
    </template>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  DataAnalysis,
  Box,
  Connection,
  Coin,
  Document,
  EditPen,
  Files,
  Monitor,
  Tickets,
  Bell,
  SetUp,
  User,
  Grid,
  DocumentChecked,
  Odometer,
  TopRight,
} from '@element-plus/icons-vue'
import AppLogo from './AppLogo.vue'
import { controlLanding, platformLanding } from '@/config/access'
import { canAccessPath } from '@/config/policy'
import { controlNavigation, platformNavigation, type NavItem } from '@/config/navigation'
import { useAuthStore } from '@/stores/auth'
import { useFeatureStore } from '@/stores/feature'
import { useScopeStore } from '@/stores/scope'
import { useUiStore } from '@/stores/ui'
import { withScopeQuery } from '@/router/scope-query'

defineProps<{ collapsed: boolean }>()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const features = useFeatureStore()
const scope = useScopeStore()
const ui = useUiStore()
const icons: Record<string, unknown> = {
  DataAnalysis,
  Box,
  Connection,
  Coin,
  Document,
  EditPen,
  Files,
  Monitor,
  Tickets,
  Bell,
  SetUp,
  User,
  Grid,
  DocumentChecked,
  Odometer,
}
const isPlatform = computed(() => route.path.startsWith('/platform'))
const isControl = computed(() => route.path.startsWith('/control'))
const activePath = computed(() => route.path)
const activeArea = computed(() =>
  isPlatform.value ? 'platform' : isControl.value ? 'console' : route.name === 'namespace' ? 'workspace' : '',
)
const featureAccess = computed(() => ({ monitoring: features.monitoring, logseer: features.logseer, audit: features.audit }))
const canManagePlatform = computed(() => canAccessPath('/platform/', auth.identities, featureAccess.value, features.auditEnabled))
function canSee(item: NavItem): boolean {
  if (item.path && !canAccessPath(item.path, auth.identities, featureAccess.value, features.auditEnabled)) return false
  return true
}
const visibleItems = computed(() =>
  (isPlatform.value ? platformNavigation : isControl.value ? controlNavigation : [])
    .filter(canSee)
    .map((item) => ({
      ...item,
      children: item.children?.filter((child) => canSee({ ...child, icon: item.icon })),
    }))
    .filter((item) => !item.children || item.children.length > 0),
)

async function onAreaSelect(index: string) {
  if (index === 'workspace') await router.push({ path: '/namespace', query: scope.query })
  else if (index === 'console') await router.push({ path: controlLanding(features.monitoring), query: scope.query })
  else if (index === 'platform') await router.push(platformLanding(auth.identities))
  ui.mobileSidebarOpen = false
}

function onSelect(index: string) {
  const item: NavItem | undefined = [...controlNavigation, ...platformNavigation].find((entry) => entry.action === index)
  if (item?.action === 'yaml') ui.yamlComposerOpen = true
  else if (item?.action === 'shell') ui.openShell()
  else router.push(withScopeQuery(index, route.query))
  ui.mobileSidebarOpen = false
}
</script>

<style scoped>
.app-sidebar {
  display: flex;
  width: var(--sidebar-width);
  height: 100%;
  flex: 0 0 var(--sidebar-width);
  color: var(--nav-text);
  background: var(--nav-bg);
  flex-direction: column;
  transition:
    width 200ms var(--ease),
    flex-basis 200ms var(--ease);
}
.app-sidebar.is-collapsed {
  width: var(--sidebar-collapsed-width);
  flex-basis: var(--sidebar-collapsed-width);
}
.app-sidebar__brand {
  display: flex;
  align-items: center;
  height: var(--header-height);
  padding: 0 20px;
  flex-shrink: 0;
}
.is-collapsed .app-sidebar__brand {
  justify-content: center;
  padding: 0;
}
.app-sidebar__areas {
  flex-shrink: 0;
  border-bottom: 1px solid rgb(255 255 255 / 8%);
}
.app-sidebar__caption {
  padding: 20px 24px 8px;
  color: #667085;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.14em;
}
.is-collapsed .app-sidebar__caption {
  display: none;
}
.app-sidebar__scroll {
  flex: 1;
}
.app-sidebar :deep(.el-menu) {
  padding: 4px 12px 20px;
  background: transparent;
  border: 0;
}
.app-sidebar :deep(.el-menu--collapse) {
  width: 100%;
  padding-inline: 10px;
}
.app-sidebar :deep(.el-menu-item),
.app-sidebar :deep(.el-sub-menu__title) {
  height: 44px;
  margin: 3px 0;
  color: var(--nav-text);
  border-radius: 8px;
  font-size: 13px;
}
.app-sidebar :deep(.el-menu-item:hover),
.app-sidebar :deep(.el-sub-menu__title:hover) {
  color: #fff;
  background: var(--nav-bg-hover);
}
.app-sidebar :deep(.el-menu-item.is-active) {
  color: var(--nav-text-active);
  background: linear-gradient(90deg, rgb(91 108 255 / 26%), rgb(91 108 255 / 14%));
  box-shadow: inset 3px 0 #8490ff;
}
.app-sidebar :deep(.el-menu-item .el-icon),
.app-sidebar :deep(.el-sub-menu__title .el-icon) {
  color: inherit;
  font-size: 18px;
}
.app-sidebar :deep(.el-sub-menu .el-menu-item) {
  min-width: 0;
  padding-left: 46px !important;
  font-size: 12px;
}
.app-sidebar :deep(.el-sub-menu.is-active > .el-sub-menu__title) {
  color: #fff;
}
.app-sidebar :deep(.el-menu--inline) {
  padding: 0;
}
.action-icon {
  margin-left: auto;
  font-size: 12px !important;
  opacity: 0.5;
}
@media (max-width: 1024px) {
  .app-sidebar {
    position: fixed;
    z-index: 1200;
    transform: translateX(0);
  }
  .app-sidebar.is-collapsed {
    width: var(--sidebar-width);
    flex-basis: var(--sidebar-width);
  }
}
</style>
