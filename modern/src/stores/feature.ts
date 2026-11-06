import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { authApi } from '@/api/auth'
import { auditApi } from '@/api/observability'

export const useFeatureStore = defineStore('feature', () => {
  const features = ref<Record<string, boolean>>({})
  const loaded = ref(false)
  const auditEnabled = ref(false)
  const monitoring = computed(() => features.value['kubecube-monitoring'] === true)
  const logseer = computed(() => features.value.logseer === true)
  const audit = computed(() => features.value.audit === true)
  const auditAvailable = computed(() => audit.value && auditEnabled.value)

  async function load() {
    try {
      const response = await authApi.features()
      features.value = Object.fromEntries(
        Object.entries(response || {}).map(([key, value]) => [key, value === 'enabled' || value === 'true']),
      )
    } catch {
      features.value = {}
    } finally {
      loaded.value = true
    }
    if (audit.value) {
      try {
        auditEnabled.value = await auditApi.enabled()
      } catch {
        auditEnabled.value = false
      }
    }
  }

  return { features, loaded, auditEnabled, monitoring, logseer, audit, auditAvailable, load }
})
