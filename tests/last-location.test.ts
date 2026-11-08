import { describe, expect, it } from 'vitest'
import { isAuthLocation, isSafeInternalPath, locationFromHash, splitInternalLocation } from '@/utils/last-location'
import { createUnauthorizedGate } from '@/utils/unauthorized'

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

  it('rejects external and login redirect targets', () => {
    expect(isSafeInternalPath('/control/pods/list')).toBe(true)
    expect(isSafeInternalPath('//evil.example.com')).toBe(false)
    expect(isSafeInternalPath('https://evil.example.com')).toBe(false)
    expect(isSafeInternalPath('/login')).toBe(false)
    expect(isSafeInternalPath('/login?redirect=/control')).toBe(false)
  })

  it('collapses concurrent unauthorized events into one navigation', () => {
    const gate = createUnauthorizedGate(1000)
    expect(gate(1000)).toBe(true)
    expect(gate(1100)).toBe(false)
    expect(gate(1500)).toBe(false)
    expect(gate(2100)).toBe(true)
  })
})
