import type { ManagerRole, RoleIdentities } from '@/types/api'

export const managerRoles: ManagerRole[] = ['platformAdmin', 'tenantAdmin', 'projectAdmin']

export function hasAnyRole(identities: RoleIdentities | undefined, roles?: ManagerRole[]): boolean {
  if (!roles?.length) return true
  return Boolean(identities && roles.some((role) => identities[role] === true))
}

export function platformLanding(identities: RoleIdentities | undefined): string {
  if (identities?.platformAdmin) return '/platform/user/list'
  if (identities?.tenantAdmin) return '/platform/tenant/tenant'
  return '/platform/role/platform'
}
