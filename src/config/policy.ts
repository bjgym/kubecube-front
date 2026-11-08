import type { ManagerRole, RoleIdentities } from '@/types/api'
import { hasAnyRole, managerRoles } from './access'

export type FeatureKey = 'monitoring' | 'logseer' | 'audit'

export interface PagePolicy {
  roles?: ManagerRole[]
  feature?: FeatureKey
  requireAuditEnabled?: boolean
  requiresManager?: boolean
}

export interface FeatureAccess {
  monitoring: boolean
  logseer: boolean
  audit: boolean
}

/**
 * The single page-authorization table. Router guards and the sidebar both read
 * this table; do not add role or feature checks to route meta or navigation
 * items. More specific prefixes must come before their parents.
 */
const policies: Array<{ prefix: string; policy: PagePolicy }> = [
  { prefix: '/platform/user/', policy: { roles: ['platformAdmin'] } },
  { prefix: '/platform/quota', policy: { roles: ['platformAdmin'] } },
  { prefix: '/platform/audit', policy: { roles: ['platformAdmin'], feature: 'audit', requireAuditEnabled: true } },
  { prefix: '/platform/monitor/', policy: { feature: 'monitoring', requiresManager: true } },
  { prefix: '/platform/PrometheusRule/', policy: { roles: ['platformAdmin'], feature: 'monitoring' } },
  { prefix: '/platform/AlertmanagerConfig', policy: { roles: ['platformAdmin'], feature: 'monitoring' } },
  { prefix: '/platform/cluster/', policy: { roles: ['platformAdmin'] } },
  { prefix: '/platform/bootstrap', policy: { roles: ['platformAdmin'] } },
  { prefix: '/platform/tenant/project', policy: { roles: ['platformAdmin', 'tenantAdmin', 'projectAdmin'] } },
  { prefix: '/platform/tenant/member', policy: { roles: ['platformAdmin', 'tenantAdmin', 'projectAdmin'] } },
  { prefix: '/platform/tenant/', policy: { roles: ['platformAdmin', 'tenantAdmin'] } },
  { prefix: '/platform/role/', policy: { roles: ['platformAdmin', 'tenantAdmin', 'projectAdmin'] } },
  { prefix: '/platform/nsquota', policy: { roles: ['platformAdmin', 'tenantAdmin', 'projectAdmin'] } },
  // Anything else under /platform is manager-only; the specific entries above
  // decide which manager role may see it.
  { prefix: '/platform/', policy: { requiresManager: true } },
  { prefix: '/control/dashboard', policy: { feature: 'monitoring' } },
  { prefix: '/control/PrometheusRule/', policy: { feature: 'monitoring' } },
  { prefix: '/control/AlertmanagerConfig', policy: { feature: 'monitoring' } },
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
  if (policy.requiresManager && !hasAnyRole(identities, managerRoles)) return false
  if (policy.roles?.length) {
    if (!identities || !policy.roles.some((role) => identities[role] === true)) return false
  }
  if (policy.feature && !features[policy.feature]) return false
  if (policy.requireAuditEnabled && !auditEnabled) return false
  return true
}
