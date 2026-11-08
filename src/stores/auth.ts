import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { accountFromLogin, authApi, type LoginPayload } from '@/api/auth'
import { storage } from '@/utils/storage'
import type { RoleIdentities, UserAccount } from '@/types/api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserAccount | null>(storage.getJSON<UserAccount>('user'))
  const identities = ref<RoleIdentities>({})
  const loading = ref(false)
  const initialized = ref(false)
  const isAuthenticated = computed(() => Boolean(user.value))
  const canManage = computed(() => Boolean(identities.value.platformAdmin || identities.value.tenantAdmin || identities.value.projectAdmin))

  async function initialize() {
    if (initialized.value || !user.value) return
    loading.value = true
    try {
      identities.value = await authApi.identities(user.value.AccountId)
      initialized.value = true
    } finally {
      loading.value = false
    }
  }

  async function login(payload: LoginPayload) {
    loading.value = true
    try {
      const response = await authApi.login(payload)
      user.value = accountFromLogin(response)
      storage.setJSON('user', user.value)
      initialized.value = false
      await initialize()
      return user.value
    } finally {
      loading.value = false
    }
  }

  function logout() {
    user.value = null
    identities.value = {}
    initialized.value = false
    storage.remove('user')
  }

  return { user, identities, loading, initialized, isAuthenticated, canManage, initialize, login, logout }
})
