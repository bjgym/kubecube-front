import { describe, expect, it } from 'vitest'
import { isAuthLocation, locationFromHash, splitInternalLocation } from '@/utils/last-location'

describe('last location', () => {
  it('splits a hash route into a path and query object', () => {
    expect(splitInternalLocation('/control/pods/list?tenant=retail&cluster=prod&namespace=shop')).toEqual({
      path: '/control/pods/list',
      query: { tenant: 'retail', cluster: 'prod', namespace: 'shop' },
    })
  })

  it('handles a hash prefix and encoded values', () => {
    expect(locationFromHash('#/control/deployments/shop-web/info?namespace=team%20a')).toEqual({
      path: '/control/deployments/shop-web/info',
      query: { namespace: 'team a' },
    })
  })

  it('returns the default path for an empty hash and detects login routes', () => {
    expect(locationFromHash('')).toEqual({ path: '/', query: {} })
    expect(isAuthLocation({ path: '/login', query: {} })).toBe(true)
    expect(isAuthLocation({ path: '/login/callback', query: {} })).toBe(true)
    expect(isAuthLocation({ path: '/control/dashboard', query: {} })).toBe(false)
  })
})
