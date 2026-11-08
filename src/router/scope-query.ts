import type { LocationQuery, LocationQueryRaw, RouteLocationRaw, Router } from 'vue-router'

export const scopeQueryKeys = ['tenant', 'project', 'cluster', 'namespace'] as const

export function pickScopeQuery(query: LocationQuery): LocationQueryRaw {
  return Object.fromEntries(
    scopeQueryKeys.flatMap((key) => {
      const value = query[key]
      return typeof value === 'string' && value ? [[key, value]] : []
    }),
  )
}

export function withScopeQuery(to: RouteLocationRaw, current: LocationQuery): RouteLocationRaw {
  const scope = pickScopeQuery(current)
  if (typeof to === 'string') return { path: to, query: scope }
  return { ...to, query: { ...scope, ...('query' in to ? to.query : {}) } }
}

export async function navigateToScope(
  router: Router,
  path: string,
  scope: LocationQueryRaw | Record<string, string | undefined>,
  extra: Record<string, string | undefined> = {},
): Promise<void> {
  const query = Object.fromEntries(
    scopeQueryKeys.flatMap((key) => {
      const value = extra[key] ?? scope[key]
      return typeof value === 'string' && value ? [[key, value]] : []
    }),
  ) as LocationQueryRaw
  await router.push({ path, query })
}
