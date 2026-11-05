import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StatusTag from '@/components/StatusTag.vue'

describe('StatusTag', () => {
  it('renders a readable status, not only a color', () => {
    const wrapper = mount(StatusTag, { props: { status: 'Running' } })
    expect(wrapper.text()).toContain('Running')
    expect(wrapper.classes()).toContain('status-tag--success')
    expect(wrapper.attributes('role')).toBe('status')
  })
  it('maps failed states to danger', () => {
    const wrapper = mount(StatusTag, { props: { status: 'Failed', label: '执行失败' } })
    expect(wrapper.text()).toBe('执行失败')
    expect(wrapper.classes()).toContain('status-tag--danger')
  })
})
