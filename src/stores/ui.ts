import { defineStore } from 'pinia'
import { ref } from 'vue'

export type Density = 'compact' | 'comfortable'

const DENSITY_STORAGE_KEY = 'kubecube-density'

function readDensity(): Density {
  try {
    return localStorage.getItem(DENSITY_STORAGE_KEY) === 'comfortable' ? 'comfortable' : 'compact'
  } catch {
    return 'compact'
  }
}

function applyDensity(value: Density) {
  document.documentElement.dataset.density = value
  try {
    localStorage.setItem(DENSITY_STORAGE_KEY, value)
  } catch {
    /* storage unavailable */
  }
}

export const useUiStore = defineStore('ui', () => {
  const density = ref<Density>(readDensity())
  applyDensity(density.value)
  const sidebarCollapsed = ref(false)
  const mobileSidebarOpen = ref(false)
  const cloudShellOpen = ref(false)
  const yamlComposerOpen = ref(false)
  const globalLoading = ref(false)
  const shellPod = ref('')
  const shellContainer = ref('')
  function openShell(pod = '', container = '') {
    shellPod.value = pod
    shellContainer.value = container
    cloudShellOpen.value = true
  }
  const toggleSidebar = () => {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }
  function setDensity(value: Density) {
    density.value = value
    applyDensity(value)
  }
  function toggleDensity() {
    setDensity(density.value === 'compact' ? 'comfortable' : 'compact')
  }
  return {
    density,
    setDensity,
    toggleDensity,
    sidebarCollapsed,
    mobileSidebarOpen,
    cloudShellOpen,
    yamlComposerOpen,
    globalLoading,
    shellPod,
    shellContainer,
    openShell,
    toggleSidebar,
  }
})
