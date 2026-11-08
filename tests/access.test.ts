import { describe, expect, it } from 'vitest'
import { hasAnyRole, controlLanding, platformLanding } from '@/config/access'

describe('manager access policy', () => {
  it('treats an omitted role list as available to every authenticated user', () => {
    expect(hasAnyRole({})).toBe(true)
    expect(hasAnyRole(undefined)).toBe(true)
  })

  it('matches only the explicitly allowed role', () => {
    const identities = { tenantAdmin: true }
    expect(hasAnyRole(identities, ['platformAdmin'])).toBe(false)
    expect(hasAnyRole(identities, ['tenantAdmin', 'projectAdmin'])).toBe(true)
  })

  it('selects a role-appropriate platform landing page', () => {
    expect(platformLanding({ platformAdmin: true })).toBe('/platform/user/list')
    expect(platformLanding({ tenantAdmin: true })).toBe('/platform/tenant/tenant')
    expect(platformLanding({ projectAdmin: true })).toBe('/platform/role/platform')
    expect(platformLanding({})).toBe('/platform/role/platform')
  })

  it('selects a resource console landing supported by the enabled features', () => {
    expect(controlLanding(true)).toBe('/control/dashboard')
    expect(controlLanding(false)).toBe('/control/deployments/list')
  })
})
