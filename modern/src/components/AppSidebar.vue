<template>
  <aside class="app-sidebar" :class="{ 'is-collapsed': collapsed }">
    <div class="app-sidebar__brand"><AppLogo :compact="collapsed" /></div>
    <div class="app-sidebar__caption">{{ isPlatform ? 'PLATFORM' : 'WORKSPACE' }}</div>
    <el-scrollbar class="app-sidebar__scroll">
      <nav :aria-label="isPlatform ? '运维管理导航' : '资源控制台导航'">
        <el-menu :default-active="activePath" :collapse="collapsed" :collapse-transition="false" @select="onSelect">
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
    <button class="app-sidebar__workspace" type="button" @click="router.push('/namespace')">
      <span class="workspace__icon"
        ><el-icon><Grid /></el-icon
      ></span>
      <span v-if="!collapsed" class="workspace__text"
        ><small>当前工作空间</small><strong>{{ scope.currentProject?.spec?.displayName || '选择项目' }}</strong></span
      >
      <el-icon v-if="!collapsed" class="workspace__arrow"><ArrowRight /></el-icon>
    </button>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowRight,
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
import { hasAnyRole } from '@/config/access'
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
const activePath = computed(() => route.path)
const visibleItems = computed(() =>
  (isPlatform.value ? platformNavigation : controlNavigation)
    .filter((item) => {
      if (!hasAnyRole(auth.identities, item.roles)) return false
      if (!item.feature) return true
      if (item.feature === 'monitoring') return features.monitoring
      if (item.feature === 'logseer') return features.logseer
      return features.audit
    })
    .map((item) => ({
      ...item,
      children: item.children?.filter((child) => hasAnyRole(auth.identities, child.roles)),
    }))
    .filter((item) => !item.children || item.children.length > 0),
)

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
.app-sidebar__workspace {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 68px;
  margin: 12px;
  padding: 12px;
  color: #d0d5dd;
  text-align: left;
  background: #1d2939;
  border: 1px solid #344054;
  border-radius: 10px;
  cursor: pointer;
}
.app-sidebar__workspace:hover {
  background: #26364c;
}
.is-collapsed .app-sidebar__workspace {
  justify-content: center;
  min-height: 48px;
  padding: 8px;
}
.workspace__icon {
  display: grid;
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
  color: #c7d2fe;
  background: rgb(91 108 255 / 20%);
  border-radius: 7px;
  place-items: center;
}
.workspace__text {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}
.workspace__text small {
  color: #98a2b3;
  font-size: 10px;
}
.workspace__text strong {
  overflow: hidden;
  margin-top: 2px;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.workspace__arrow {
  font-size: 12px;
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
