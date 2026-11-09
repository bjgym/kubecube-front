import { describe, expect, it } from 'vitest'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { scopeChangePath, scopeChangeQuery, type ScopeSnapshot } from '@/router/scope-transition'

const scope: ScopeSnapshot = {
  tenant: 'digital-retail',
  project: 'online-business',
  cluster: 'production-shanghai',
  namespace: 'online-shop',
}

function route(path: string, workload?: string): RouteLocationNormalizedLoaded {
  return { path, params: workload ? { workload } : {} } as RouteLocationNormalizedLoaded
}

describe('scope changes', () => {
  it('resets dependent project and space when the tenant changes', () => {
    expect(scopeChangeQuery('tenant', 'data-ai', scope)).toEqual({ tenant: 'data-ai', cluster: 'production-shanghai' })
  })

  it('resets the space when the project or cluster changes', () => {
    expect(scopeChangeQuery('project', 'customer-growth', scope)).toEqual({
      tenant: 'digital-retail',
      project: 'customer-growth',
      cluster: 'production-shanghai',
    })
    expect(scopeChangeQuery('cluster', 'staging-hangzhou', scope)).toEqual({
      tenant: 'digital-retail',
      project: 'online-business',
      cluster: 'staging-hangzhou',
    })
  })

  it('keeps the full context when the space changes', () => {
    expect(scopeChangeQuery('namespace', 'shop-staging', scope)).toEqual({
      tenant: 'digital-retail',
      project: 'online-business',
      cluster: 'production-shanghai',
      namespace: 'shop-staging',
    })
  })

  it('returns tenant and project changes to the space overview', () => {
    expect(scopeChangePath('tenant', route('/control/deployments/list', 'deployments'))).toBe('/namespace')
    expect(scopeChangePath('project', route('/control/deployments/shop-web/info', 'deployments'))).toBe('/namespace')
  })

  it('returns detail and editor scope changes to the same resource list', () => {
    expect(scopeChangePath('namespace', route('/control/deployments/shop-web/info', 'deployments'))).toBe('/control/deployments/list')
    expect(scopeChangePath('cluster', route('/control/deployments/create', 'deployments'))).toBe('/control/deployments/list')
  })

  it('leaves list and dashboard routes on the same path', () => {
    expect(scopeChangePath('namespace', route('/control/deployments/list', 'deployments'))).toBe('/control/deployments/list')
    expect(scopeChangePath('namespace', route('/control/dashboard'))).toBe('/control/dashboard')
    expect(scopeChangePath('cluster', route('/namespace'))).toBe('/namespace')
  })
})
