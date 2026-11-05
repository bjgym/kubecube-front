import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { authApi } from '@/api/auth'

export const useFeatureStore = defineStore('feature', () => {
  const features = ref<Record<string, boolean>>({})
  const loaded = ref(false)
  const monitoring = computed(() => features.value['kubecube-monitoring'] === true)
  const logseer = computed(() => features.value.logseer === true)
  const audit = computed(() => features.value.audit === true)

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
  }

  return { features, loaded, monitoring, logseer, audit, load }
})
