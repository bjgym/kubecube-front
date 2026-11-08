import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useUiStore } from '@/stores/ui'

describe('ui density', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.dataset.density = ''
    setActivePinia(createPinia())
  })

  it('defaults to compact and applies it to the document', () => {
    const ui = useUiStore()
    expect(ui.density).toBe('compact')
    expect(document.documentElement.dataset.density).toBe('compact')
  })

  it('toggles density and persists the choice', () => {
    const ui = useUiStore()
    ui.toggleDensity()
    expect(ui.density).toBe('comfortable')
    expect(document.documentElement.dataset.density).toBe('comfortable')
    expect(localStorage.getItem('kubecube-density')).toBe('comfortable')

    ui.toggleDensity()
    expect(ui.density).toBe('compact')
    expect(localStorage.getItem('kubecube-density')).toBe('compact')
  })
})
