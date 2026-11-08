<template>
  <header class="app-header">
    <div class="app-header__left">
      <button class="icon-button" type="button" :aria-label="mobile ? '打开导航' : '折叠或展开导航'" @click="toggle">
        <el-icon><Fold v-if="!mobile && !ui.sidebarCollapsed" /><Expand v-else-if="!mobile" /><Menu v-else /></el-icon>
      </button>
      <div class="app-header__area">
        <span>{{ areaTitle }}</span
        ><small>{{ areaSubtitle }}</small>
      </div>
    </div>
    <div class="app-header__right">
      <span v-if="mock" class="mock-badge">UI 预览</span>
      <el-dropdown trigger="click" @command="onCommand">
        <button class="user-menu" type="button" aria-label="用户菜单">
          <span class="avatar">{{ avatarText }}</span>
          <span class="user-info"
            ><strong>{{ auth.user?.AccountDisplayName }}</strong
            ><small>{{ roleText }}</small></span
          >
          <el-icon><ArrowDown /></el-icon>
        </button>
        <template #dropdown
          ><el-dropdown-menu>
            <el-dropdown-item command="density"
              ><el-icon><Operation /></el-icon>{{ ui.density === 'compact' ? '切换为舒适布局' : '切换为紧凑布局' }}</el-dropdown-item
            >
            <el-dropdown-item command="keys"
              ><el-icon><Key /></el-icon>密钥管理</el-dropdown-item
            >
            <el-dropdown-item divided command="logout"
              ><el-icon><SwitchButton /></el-icon>安全退出</el-dropdown-item
            >
          </el-dropdown-menu></template
        >
      </el-dropdown>
    </div>
  </header>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowDown, Expand, Fold, Key, Menu, Operation, SwitchButton } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { useScopeStore } from '@/stores/scope'
import { useUiStore } from '@/stores/ui'
const props = defineProps<{ mobile: boolean }>()
const emit = defineEmits<{ toggle: [] }>()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const scope = useScopeStore()
const ui = useUiStore()
const isPlatform = computed(() => route.path.startsWith('/platform'))
const areaTitle = computed(() => {
  if (isPlatform.value) return '运维管理'
  if (route.name === 'namespace') return '工作空间'
  if (route.path.startsWith('/control')) return '资源控制台'
  return '账户设置'
})
const areaSubtitle = computed(() => {
  if (isPlatform.value) return '组织、集群与平台治理'
  if (route.name === 'namespace') return '跨集群空间与资源总览'
  if (route.path.startsWith('/control')) return '多集群 Kubernetes 工作空间'
  return '账号密钥与访问管理'
})
const mock = import.meta.env.VITE_USE_MOCK === 'true'
const avatarText = computed(() => (auth.user?.AccountDisplayName || auth.user?.AccountId || 'U').slice(0, 1).toUpperCase())
const roleText = computed(() =>
  auth.identities.platformAdmin
    ? '平台管理员'
    : auth.identities.tenantAdmin
      ? '租户管理员'
      : auth.identities.projectAdmin
        ? '项目管理员'
        : '平台用户',
)
const toggle = () => {
  if (props.mobile) ui.mobileSidebarOpen = true
  else emit('toggle')
}
function onCommand(command: string) {
  if (command === 'density') ui.toggleDensity()
  else if (command === 'keys') router.push('/metauser/openapi')
  else {
    auth.logout()
    scope.reset()
    router.push('/login')
  }
}
</script>
<style scoped>
.app-header {
  display: flex;
  height: var(--header-height);
  padding: 0 24px;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  flex-shrink: 0;
  background: #fff;
  border-bottom: 1px solid var(--border-light);
}
.app-header__left,
.app-header__right {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}
.icon-button {
  display: grid;
  width: 36px;
  height: 36px;
  padding: 0;
  color: var(--text-secondary);
  background: transparent;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
  place-items: center;
  font-size: 19px;
}
.icon-button:hover {
  color: var(--brand-600);
  background: var(--brand-50);
}
.app-header__area {
  display: flex;
  flex-direction: column;
}
.app-header__area > span {
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 600;
}
.app-header__area small {
  margin-top: 1px;
  color: var(--text-tertiary);
  font-size: 11px;
}
.mock-badge {
  padding: 3px 8px;
  color: #b54708;
  background: #fffaeb;
  border: 1px solid #fedf89;
  border-radius: 5px;
  font-size: 11px;
}
.user-menu {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 0 5px 5px;
  color: var(--text-regular);
  text-align: left;
  background: transparent;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
}
.avatar {
  display: grid;
  width: 34px;
  height: 34px;
  color: #fff;
  background: linear-gradient(145deg, #6673df, #344054);
  border-radius: 9px;
  place-items: center;
  font-size: 13px;
  font-weight: 600;
}
.user-info {
  display: flex;
  min-width: 0;
  flex-direction: column;
}
.user-info strong {
  max-width: 110px;
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.user-info small {
  color: var(--text-tertiary);
  font-size: 10px;
}
@media (max-width: 768px) {
  .app-header {
    padding: 0 14px;
  }
  .app-header__area small,
  .user-info {
    display: none;
  }
  .app-header__right {
    gap: 8px;
  }
}
</style>
