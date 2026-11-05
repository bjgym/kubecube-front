import { describe, expect, it } from 'vitest'
import { mergeIngressSpec } from '@/domain/ingress'

describe('mergeIngressSpec', () => {
  it('serializes multiple hosts, paths and TLS secrets', () => {
    const merged = mergeIngressSpec(
      { annotations: { 'nginx.ingress.kubernetes.io/rewrite-target': '/' } },
      {
        className: 'nginx',
        editing: false,
        rules: [
          {
            host: 'shop.example.com',
            paths: [
              { path: '/', pathType: 'Prefix', serviceName: 'shop-web', servicePort: 80 },
              { path: '/api', pathType: 'Prefix', serviceName: 'order-service', servicePort: 8080 },
            ],
          },
          { host: 'admin.example.com', paths: [{ path: '/', pathType: 'Exact', serviceName: 'admin', servicePort: 80 }] },
        ],
        tls: [{ hosts: 'shop.example.com, admin.example.com', secretName: 'shop-tls' }],
      },
    )
    expect(merged.rules).toHaveLength(2)
    expect(merged.rules[0].http.paths).toHaveLength(2)
    expect(merged.rules[1].host).toBe('admin.example.com')
    expect(merged.tls).toEqual([{ hosts: ['shop.example.com', 'admin.example.com'], secretName: 'shop-tls' }])
    expect(merged.annotations).toEqual({ 'nginx.ingress.kubernetes.io/rewrite-target': '/' })
  })

  it('removes TLS from an edited Ingress when all entries are cleared', () => {
    const merged = mergeIngressSpec({ tls: [{ secretName: 'old' }] }, { className: '', rules: [], tls: [], editing: true })
    expect(merged.rules).toEqual([])
    expect(merged.tls).toEqual([])
    expect(merged).not.toHaveProperty('ingressClassName')
  })
})
