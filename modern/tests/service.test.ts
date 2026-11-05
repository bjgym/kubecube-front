import { describe, expect, it } from 'vitest'
import { mergeServiceSpec, type ServicePortForm } from '@/domain/service'

const base = {
  type: 'ClusterIP',
  clusterIP: '10.96.18.24',
  ports: [{ port: 80, targetPort: 8080, protocol: 'TCP' }],
  selector: { app: 'shop-web', tier: 'frontend' },
}
const ports: ServicePortForm[] = [{ name: 'http', port: 80, targetPort: 8080, protocol: 'TCP' }]
const defaults = {
  type: 'ClusterIP',
  ports,
  selector: { app: 'shop-web', tier: 'frontend' },
  editing: true,
  headless: false,
  externalIPs: [] as string[],
  sessionAffinity: 'None' as const,
}

describe('mergeServiceSpec', () => {
  it('preserves an untouched selector when editing a differently named Service', () => {
    const merged = mergeServiceSpec(base, defaults)
    expect(merged.selector).toEqual({ app: 'shop-web', tier: 'frontend' })
    expect(merged.ports[0]).toMatchObject({ port: 80, targetPort: 8080, protocol: 'TCP' })
    expect(merged.sessionAffinity).toBe('None')
  })

  it('does not infer a selector from the Service name on create', () => {
    const merged = mergeServiceSpec({ ports: [] }, { ...defaults, selector: {}, editing: false })
    expect(merged).not.toHaveProperty('selector')
  })

  it('allows clearing an existing selector explicitly', () => {
    const merged = mergeServiceSpec(base, { ...defaults, selector: {} })
    expect(merged.selector).toEqual({})
  })

  it('serializes multiple ports, nodePort, external IPs, session affinity and headless mode', () => {
    const merged = mergeServiceSpec(
      { ports: [] },
      {
        ...defaults,
        type: 'NodePort',
        editing: false,
        selector: { app: 'orders' },
        headless: true,
        externalIPs: ['203.0.113.10'],
        sessionAffinity: 'ClientIP',
        sessionAffinitySeconds: 3600,
        ports: [
          { name: 'http', port: 80, targetPort: 8080, protocol: 'TCP', nodePort: 30080 },
          { name: 'metrics', port: 9090, targetPort: 9090, protocol: 'TCP' },
        ],
      },
    )
    expect(merged.selector).toEqual({ app: 'orders' })
    expect(merged.ports).toEqual([
      { name: 'http', port: 80, targetPort: 8080, protocol: 'TCP', nodePort: 30080 },
      { name: 'metrics', port: 9090, targetPort: 9090, protocol: 'TCP' },
    ])
    expect(merged).toMatchObject({
      clusterIP: 'None',
      externalIPs: ['203.0.113.10'],
      sessionAffinity: 'ClientIP',
      sessionAffinityConfig: { clientIP: { timeoutSeconds: 3600 } },
    })
  })
})
