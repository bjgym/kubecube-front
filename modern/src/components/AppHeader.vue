<template>
  <header class="app-header">
    <div class="app-header__left">
      <button class="icon-button" type="button" :aria-label="mobile ? '打开导航' : '折叠或展开导航'" @click="toggle">
        <el-icon><Fold v-if="!mobile && !ui.sidebarCollapsed" /><Expand v-else-if="!mobile" /><Menu v-else /></el-icon>
      </button>
      <div class="app-header__area">
        <span>{{ isPlatform ? '运维管理' : '资源控制台' }}</span
        ><small>{{ isPlatform ? '组织、集群与平台治理' : '多集群 Kubernetes 工作空间' }}</small>
      </div>
    </div>
    <div class="app-header__right">
      <span v-if="mock" class="mock-badge">UI 预览</span>
      <el-tooltip :content="isPlatform ? '进入资源控制台' : '进入运维管理'" placement="bottom">
        <el-button v-if="auth.canManage" class="switch-button" @click="switchArea"
          ><el-icon><Switch /></el-icon><span>{{ isPlatform ? '资源控制台' : '运维管理' }}</span></el-button
        >
      </el-tooltip>
      <span class="divider" />
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
import { ArrowDown, Expand, Fold, Key, Menu, Switch, SwitchButton } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { useScopeStore } from '@/stores/scope'
import { useUiStore } from '@/stores/ui'
import { platformLanding } from '@/config/access'
const props = defineProps<{ mobile: boolean }>()
const emit = defineEmits<{ toggle: [] }>()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const scope = useScopeStore()
const ui = useUiStore()
const isPlatform = computed(() => route.path.startsWith('/platform'))
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
const switchArea = () => router.push(isPlatform.value ? '/namespace' : platformLanding(auth.identities))
function onCommand(command: string) {
  if (command === 'keys') router.push('/metauser/openapi')
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
.switch-button {
  color: var(--text-regular);
  background: var(--surface-subtle);
  border-color: var(--border-light);
}
.mock-badge {
  padding: 3px 8px;
  color: #b54708;
  background: #fffaeb;
  border: 1px solid #fedf89;
  border-radius: 5px;
  font-size: 11px;
}
.divider {
  width: 1px;
  height: 26px;
  background: var(--border-light);
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
  .user-info,
  .divider,
  .switch-button span {
    display: none;
  }
  .app-header__right {
    gap: 8px;
  }
  .switch-button {
    width: 36px;
    padding: 0;
  }
}
</style>
