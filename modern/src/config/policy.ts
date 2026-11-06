import type { ManagerRole, RoleIdentities } from '@/types/api'

export type FeatureKey = 'monitoring' | 'logseer' | 'audit'

export interface PagePolicy {
  roles?: ManagerRole[]
  feature?: FeatureKey
  requireAuditEnabled?: boolean
}

export interface FeatureAccess {
  monitoring: boolean
  logseer: boolean
  audit: boolean
}

const policies: Array<{ prefix: string; policy: PagePolicy }> = [
  { prefix: '/platform/user/', policy: { roles: ['platformAdmin'] } },
  { prefix: '/platform/quota', policy: { roles: ['platformAdmin'] } },
  { prefix: '/platform/audit', policy: { roles: ['platformAdmin'], feature: 'audit', requireAuditEnabled: true } },
  { prefix: '/platform/monitor/', policy: { feature: 'monitoring' } },
  { prefix: '/platform/PrometheusRule/', policy: { roles: ['platformAdmin'], feature: 'monitoring' } },
  { prefix: '/platform/AlertmanagerConfig', policy: { roles: ['platformAdmin'], feature: 'monitoring' } },
  { prefix: '/platform/cluster/', policy: { roles: ['platformAdmin'] } },
  { prefix: '/platform/bootstrap', policy: { roles: ['platformAdmin'] } },
  { prefix: '/platform/tenant/member', policy: { roles: ['platformAdmin', 'tenantAdmin', 'projectAdmin'] } },
  { prefix: '/platform/tenant/', policy: { roles: ['platformAdmin', 'tenantAdmin'] } },
  { prefix: '/platform/role/', policy: { roles: ['platformAdmin', 'tenantAdmin', 'projectAdmin'] } },
  { prefix: '/platform/nsquota', policy: { roles: ['platformAdmin', 'tenantAdmin', 'projectAdmin'] } },
  { prefix: '/control/dashboard', policy: { feature: 'monitoring' } },
  { prefix: '/control/lens/', policy: { feature: 'logseer' } },
  { prefix: '/control/logconfigs/', policy: { feature: 'logseer' } },
]

export function policyForPath(path: string): PagePolicy {
  return policies.find((entry) => path.startsWith(entry.prefix))?.policy || {}
}

export function canAccessPath(
  path: string,
  identities: RoleIdentities | undefined,
  features: FeatureAccess,
  auditEnabled: boolean,
): boolean {
  const policy = policyForPath(path)
  if (policy.roles?.length) {
    if (!identities || !policy.roles.some((role) => identities[role] === true)) return false
  }
  if (policy.feature && !features[policy.feature]) return false
  if (policy.requireAuditEnabled && !auditEnabled) return false
  return true
}
