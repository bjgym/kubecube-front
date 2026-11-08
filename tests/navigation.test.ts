import { describe, expect, it } from 'vitest'
import router from '@/router'
import { policyForPath } from '@/config/policy'
import { controlNavigation, platformNavigation, type NavItem } from '@/config/navigation'

function paths(items: NavItem[]): string[] {
  return items.flatMap((item) => [...(item.path ? [item.path] : []), ...(item.children?.map((child) => child.path) || [])])
}

describe('navigation and policy', () => {
  it('resolves every navigation entry to a real route', () => {
    for (const path of paths([...controlNavigation, ...platformNavigation])) {
      const resolved = router.resolve(path)
      expect(resolved.name, path).not.toBe('not-found')
    }
  })

  it('has a policy for every platform navigation path', () => {
    for (const path of paths(platformNavigation)) {
      expect(policyForPath(path), path).not.toEqual({})
    }
  })

  it('keeps the control navigation free of feature-specific duplicated fields', () => {
    for (const item of controlNavigation) {
      expect(item).not.toHaveProperty('feature')
      expect(item).not.toHaveProperty('roles')
    }
  })
})
