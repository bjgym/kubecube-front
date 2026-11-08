import { describe, expect, it } from 'vitest'
import { canAccessPath } from '@/config/policy'
import type { RoleIdentities } from '@/types/api'

const platform: RoleIdentities = { platformAdmin: true, tenantAdmin: false, projectAdmin: false }
const tenant: RoleIdentities = { platformAdmin: false, tenantAdmin: true, projectAdmin: false }
const project: RoleIdentities = { platformAdmin: false, tenantAdmin: false, projectAdmin: true }
const normal: RoleIdentities = {}
const features = { monitoring: true, logseer: true, audit: true }

describe('page policy', () => {
  it('keeps platform-only pages for platform administrators', () => {
    expect(canAccessPath('/platform/user/list', platform, features, true)).toBe(true)
    expect(canAccessPath('/platform/user/list', tenant, features, true)).toBe(false)
    expect(canAccessPath('/platform/quota', project, features, true)).toBe(false)
    expect(canAccessPath('/platform/cluster/list', tenant, features, true)).toBe(false)
  })

  it('gives tenant and project administrators their scoped pages', () => {
    expect(canAccessPath('/platform/tenant/tenant', tenant, features, true)).toBe(true)
    expect(canAccessPath('/platform/tenant/tenant', project, features, true)).toBe(false)
    expect(canAccessPath('/platform/tenant/project', project, features, true)).toBe(true)
    expect(canAccessPath('/platform/tenant/member', project, features, true)).toBe(true)
    expect(canAccessPath('/platform/role/platform', project, features, true)).toBe(true)
    expect(canAccessPath('/platform/nsquota', project, features, true)).toBe(true)
  })

  it('requires a manager identity for the generic platform pages', () => {
    expect(canAccessPath('/platform/monitor/list', normal, features, true)).toBe(false)
    expect(canAccessPath('/platform/monitor/list', tenant, features, true)).toBe(true)
    expect(canAccessPath('/platform/tenant/project', normal, features, true)).toBe(false)
  })

  it('keeps normal users out of every platform page but inside control pages', () => {
    expect(canAccessPath('/platform/role/platform', normal, features, true)).toBe(false)
    expect(canAccessPath('/platform/nsquota', normal, features, true)).toBe(false)
    expect(canAccessPath('/control/deployments/list', normal, features, true)).toBe(true)
  })

  it('requires both the audit feature and the audit enabled endpoint', () => {
    expect(canAccessPath('/platform/audit', platform, features, true)).toBe(true)
    expect(canAccessPath('/platform/audit', platform, features, false)).toBe(false)
    expect(canAccessPath('/platform/audit', platform, { ...features, audit: false }, true)).toBe(false)
  })

  it('applies feature gates to control pages', () => {
    expect(canAccessPath('/control/dashboard', normal, features, true)).toBe(true)
    expect(canAccessPath('/control/dashboard', normal, { ...features, monitoring: false }, true)).toBe(false)
    expect(canAccessPath('/control/lens/normal', normal, { ...features, logseer: false }, true)).toBe(false)
    expect(canAccessPath('/control/PrometheusRule/list', normal, { ...features, monitoring: false }, true)).toBe(false)
    expect(canAccessPath('/control/AlertmanagerConfig/list', normal, { ...features, monitoring: false }, true)).toBe(false)
  })
})
