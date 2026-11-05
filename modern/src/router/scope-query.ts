import type { LocationQuery, LocationQueryRaw, RouteLocationRaw } from 'vue-router'

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
