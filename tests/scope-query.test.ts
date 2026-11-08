import { describe, expect, it } from 'vitest'
import { navigateToScope, pickScopeQuery, withScopeQuery } from '@/router/scope-query'
import type { LocationQuery, Router } from 'vue-router'

const query = { tenant: 'retail', project: 'shop', cluster: 'prod', namespace: 'online', podName: 'web-1' } satisfies LocationQuery

describe('scope query compatibility', () => {
  it('keeps only the four context keys when requested', () => {
    expect(pickScopeQuery(query)).toEqual({ tenant: 'retail', project: 'shop', cluster: 'prod', namespace: 'online' })
  })
  it('inherits context without discarding route-specific query', () => {
    expect(withScopeQuery({ path: '/control/pods/1/log', query: { containerName: 'app' } }, query)).toEqual({
      path: '/control/pods/1/log',
      query: { tenant: 'retail', project: 'shop', cluster: 'prod', namespace: 'online', containerName: 'app' },
    })
  })
  it('supports string navigation while retaining context', () => {
    expect(withScopeQuery('/namespace', query)).toEqual({ path: '/namespace', query: pickScopeQuery(query) })
  })
  it('navigates with one explicit scope target and overrides the clicked namespace', async () => {
    const pushes: unknown[] = []
    const router = { push: async (location: unknown) => pushes.push(location) } as unknown as Router
    await navigateToScope(router, '/control/deployments/list', query, { cluster: 'staging', namespace: 'shop-staging' })
    expect(pushes).toEqual([
      {
        path: '/control/deployments/list',
        query: { tenant: 'retail', project: 'shop', cluster: 'staging', namespace: 'shop-staging' },
      },
    ])
  })
})
