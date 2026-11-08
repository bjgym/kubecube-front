import { describe, expect, it } from 'vitest'
import { mergeNetworkPolicySpec, networkPolicyToForm, newNetworkPolicyForm } from '@/domain/network-policy'

describe('NetworkPolicy form', () => {
  it('serializes pod, namespace and CIDR peers with ports', () => {
    const form = newNetworkPolicyForm()
    form.podSelector = [{ key: 'app', value: 'shop-web' }]
    form.policyTypes = ['Ingress', 'Egress']
    form.ingress = [
      {
        peers: [
          { type: 'podSelector', labelKey: 'role', labelValue: 'frontend', cidr: '', except: '' },
          { type: 'namespaceSelector', labelKey: 'team', labelValue: 'ops', cidr: '', except: '' },
          { type: 'ipBlock', labelKey: '', labelValue: '', cidr: '203.0.113.0/24', except: '203.0.113.9/32' },
        ],
        ports: [{ protocol: 'TCP', port: '443' }],
      },
    ]
    form.egress = [{ peers: [], ports: [{ protocol: 'UDP', port: 'dns', endPort: 5353 }] }]
    expect(mergeNetworkPolicySpec({}, form)).toEqual({
      podSelector: { matchLabels: { app: 'shop-web' } },
      policyTypes: ['Ingress', 'Egress'],
      ingress: [
        {
          from: [
            { podSelector: { matchLabels: { role: 'frontend' } } },
            { namespaceSelector: { matchLabels: { team: 'ops' } } },
            { ipBlock: { cidr: '203.0.113.0/24', except: ['203.0.113.9/32'] } },
          ],
          ports: [{ protocol: 'TCP', port: 443 }],
        },
      ],
      egress: [{ ports: [{ protocol: 'UDP', port: 'dns', endPort: 5353 }] }],
    })
  })

  it('round-trips an existing NetworkPolicy', () => {
    const form = networkPolicyToForm({
      podSelector: { matchLabels: { app: 'db' } },
      policyTypes: ['Egress'],
      egress: [
        {
          to: [{ namespaceSelector: { matchLabels: { env: 'prod' } } }],
          ports: [{ protocol: 'TCP', port: 5432 }],
        },
      ],
    })
    expect(form).toMatchObject({
      podSelector: [{ key: 'app', value: 'db' }],
      policyTypes: ['Egress'],
    })
    expect(form.egress[0]?.peers[0]).toMatchObject({ type: 'namespaceSelector', labelKey: 'env', labelValue: 'prod' })
    expect(form.egress[0]?.ports[0]).toEqual({ protocol: 'TCP', port: '5432', endPort: undefined })
  })
})
