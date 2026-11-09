import type { RouteLocationNormalizedLoaded } from 'vue-router'
import type { ScopeQuery } from '@/stores/scope'

export type ScopeField = 'tenant' | 'project' | 'cluster' | 'namespace'

export interface ScopeSnapshot {
  tenant: string
  project: string
  cluster: string
  namespace: string
}

const scopeKeys = ['tenant', 'project', 'cluster', 'namespace'] as const

function compact(values: ScopeSnapshot): ScopeQuery {
  return Object.fromEntries(scopeKeys.flatMap((key) => (values[key] ? [[key, values[key]]] : [])))
}

/**
 * The query for a scope change. Tenant and project changes start a new child
 * scope, so the dependent project/space is intentionally omitted; the scope
 * store chooses the first available value after navigation is accepted.
 */
export function scopeChangeQuery(field: ScopeField, value: string, current: ScopeSnapshot): ScopeQuery {
  switch (field) {
    case 'tenant':
      return compact({ ...current, tenant: value, project: '', namespace: '' })
    case 'project':
      return compact({ ...current, project: value, namespace: '' })
    case 'cluster':
      return compact({ ...current, cluster: value, namespace: '' })
    case 'namespace':
      return compact({ ...current, namespace: value })
  }
}

/**
 * A scope change from a resource detail or editor returns to the same resource
 * list. Tenant and project changes always return to the workspace overview.
 */
export function scopeChangePath(field: ScopeField, route: RouteLocationNormalizedLoaded): string {
  if (field === 'tenant' || field === 'project') return '/namespace'
  const workload = route.params.workload
  if (workload && !route.path.endsWith('/list')) return `/control/${String(workload)}/list`
  return route.path
}
