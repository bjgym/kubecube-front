import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * Shared viewport facts. Components should not read window.innerWidth in a
 * computed property: that value is not reactive and produces stale layouts
 * after a resize.
 */
export function useViewport() {
  const width = ref(typeof window === 'undefined' ? 1440 : window.innerWidth)
  const isWide = computed(() => width.value >= 1500)
  const isDesktop = computed(() => width.value >= 1200)
  const isTablet = computed(() => width.value < 1024)
  const isMobile = computed(() => width.value < 768)
  const update = () => {
    width.value = window.innerWidth
  }
  onMounted(() => window.addEventListener('resize', update))
  onBeforeUnmount(() => window.removeEventListener('resize', update))
  return { width, isWide, isDesktop, isTablet, isMobile }
}
