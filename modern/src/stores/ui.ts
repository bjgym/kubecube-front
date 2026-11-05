import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
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
  return {
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
