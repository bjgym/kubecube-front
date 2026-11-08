import { describe, expect, it } from 'vitest'
import type { KubeResource } from '@/types/api'
import { networkPolicyFormAdapter } from '@/views/control/resource-editor/adapters/networkPolicy'
import { secretFormAdapter } from '@/views/control/resource-editor/adapters/secret'
import { serviceFormAdapter } from '@/views/control/resource-editor/adapters/service'
import { getResourceFormAdapter, resourceFormAdapters } from '@/views/control/resource-editor/types'

const base64 = (value: string) => btoa(value)

const existingService: KubeResource = {
  apiVersion: 'v1',
  kind: 'Service',
  metadata: {
    name: 'shop-web',
    namespace: 'shop',
    labels: { app: 'shop-web', tier: 'frontend' },
    annotations: { owner: 'team-a' },
  },
  spec: {
    type: 'ClusterIP',
    clusterIP: '10.96.18.24',
    clusterIPs: ['10.96.18.24'],
    ports: [{ name: 'http', port: 80, targetPort: 8080, protocol: 'TCP' }],
    selector: { app: 'shop-web', tier: 'frontend' },
  },
}

describe('resource editor adapter registry', () => {
  it('resolves the extracted adapters by resource config key and leaves other resources on the fallback', () => {
    expect(getResourceFormAdapter('services')).toBe(serviceFormAdapter)
    expect(getResourceFormAdapter('secrets')).toBe(secretFormAdapter)
    expect(getResourceFormAdapter('networkpolicies')).toBe(networkPolicyFormAdapter)
    expect(getResourceFormAdapter('deployments')).toBeUndefined()
    expect(Object.keys(resourceFormAdapters).sort()).toEqual(['networkpolicies', 'secrets', 'services'])
  })
})

describe('Service adapter', () => {
  it('round-trips an untouched selector and preserves server-managed fields when editing', () => {
    const form = serviceFormAdapter.fillForm(existingService)
    expect(form.serviceSelector).toEqual([
      { key: 'app', value: 'shop-web' },
      { key: 'tier', value: 'frontend' },
    ])
    expect(form.serviceType).toBe('ClusterIP')

    const built = serviceFormAdapter.buildResource(form, existingService)
    expect(built).toMatchObject({
      apiVersion: 'v1',
      kind: 'Service',
      metadata: { name: 'shop-web', namespace: 'shop', labels: { app: 'shop-web', tier: 'frontend' } },
      spec: { type: 'ClusterIP', clusterIP: '10.96.18.24', selector: { app: 'shop-web', tier: 'frontend' } },
    })
    expect(built.metadata.annotations).toEqual({ owner: 'team-a' })
  })

  it('applies an explicit selector edit and does not infer a selector on create', () => {
    const form = serviceFormAdapter.fillForm(existingService)
    form.serviceSelector = [{ key: 'app', value: 'orders' }]
    expect(serviceFormAdapter.buildResource(form, existingService).spec).toMatchObject({ selector: { app: 'orders' } })

    const created = serviceFormAdapter.createEmptyForm()
    created.name = 'orders'
    created.namespace = 'shop'
    expect(serviceFormAdapter.buildResource(created).spec).not.toHaveProperty('selector')
  })

  it('serializes NodePort, headless mode, external IPs and session affinity', () => {
    const form = serviceFormAdapter.createEmptyForm()
    form.name = 'orders'
    form.namespace = 'shop'
    form.serviceType = 'NodePort'
    form.serviceHeadless = true
    form.serviceSessionAffinity = 'ClientIP'
    form.serviceSessionAffinitySeconds = 3600
    form.serviceExternalIps = '203.0.113.10, 203.0.113.11'
    form.servicePorts = [{ name: 'http', port: 80, targetPort: 8080, protocol: 'TCP', nodePort: 30080 }]
    expect(serviceFormAdapter.buildResource(form).spec).toMatchObject({
      type: 'NodePort',
      clusterIP: 'None',
      externalIPs: ['203.0.113.10', '203.0.113.11'],
      ports: [{ name: 'http', port: 80, targetPort: 8080, protocol: 'TCP', nodePort: 30080 }],
      sessionAffinity: 'ClientIP',
      sessionAffinityConfig: { clientIP: { timeoutSeconds: 3600 } },
    })
  })
})

describe('Secret adapter', () => {
  const tlsSecret: KubeResource = {
    apiVersion: 'v1',
    kind: 'Secret',
    metadata: { name: 'shop-tls', namespace: 'shop', labels: { app: 'shop-web' } },
    type: 'kubernetes.io/tls',
    data: {
      'tls.crt': base64('-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n'),
      'tls.key': base64('-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----\n'),
    },
  }

  it('decodes base64 TLS material when filling and submits it as stringData', () => {
    const form = secretFormAdapter.fillForm(tlsSecret)
    expect(form.secretType).toBe('kubernetes.io/tls')
    expect(form.tlsCrt).toContain('BEGIN CERTIFICATE')
    expect(form.tlsKey).toContain('BEGIN PRIVATE KEY')

    const built = secretFormAdapter.buildResource(form, tlsSecret)
    expect(built.type).toBe('kubernetes.io/tls')
    expect(built.stringData).toEqual({
      'tls.crt': '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n',
      'tls.key': '-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----\n',
    })
    expect(built.data).toEqual(tlsSecret.data)
  })

  it('keeps opaque data masked and only submits keys the user changed', () => {
    const opaqueSecret: KubeResource = {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: { name: 'shop-config', namespace: 'shop', labels: { app: 'shop-web' } },
      type: 'Opaque',
      data: { password: base64('old-secret'), 'config.json': base64('{}') },
    }
    const form = secretFormAdapter.fillForm(opaqueSecret)
    expect(form.data).toEqual([
      { key: 'password', value: '' },
      { key: 'config.json', value: '' },
    ])

    const untouched = secretFormAdapter.buildResource(form, opaqueSecret)
    expect(untouched.data).toEqual({ password: base64('old-secret'), 'config.json': base64('{}') })
    expect(untouched.stringData).toEqual({})

    form.data[0]!.value = 'new-secret'
    form.data.push({ key: 'added', value: 'plain' })
    const updated = secretFormAdapter.buildResource(form, opaqueSecret)
    expect(updated.data).toEqual({ password: base64('old-secret'), 'config.json': base64('{}') })
    expect(updated.stringData).toEqual({ password: 'new-secret', added: 'plain' })
  })

  it('round-trips dockerconfigjson credentials and recomputes auth', () => {
    const dockerConfig = JSON.stringify({
      auths: { 'https://index.docker.io/v1/': { username: 'robot', password: 'token', email: 'ops@example.com' } },
    })
    const registrySecret: KubeResource = {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: { name: 'registry', namespace: 'shop', labels: { app: 'shop-web' } },
      type: 'kubernetes.io/dockerconfigjson',
      data: { '.dockerconfigjson': base64(dockerConfig) },
    }
    const form = secretFormAdapter.fillForm(registrySecret)
    expect(form).toMatchObject({
      registryServer: 'https://index.docker.io/v1/',
      registryUsername: 'robot',
      registryPassword: 'token',
      registryEmail: 'ops@example.com',
    })

    const built = secretFormAdapter.buildResource(form, registrySecret)
    const emitted = JSON.parse(String((built.stringData as Record<string, string>)['.dockerconfigjson']))
    expect(emitted.auths['https://index.docker.io/v1/']).toEqual({
      username: 'robot',
      password: 'token',
      email: 'ops@example.com',
      auth: btoa('robot:token'),
    })
  })
})

describe('NetworkPolicy adapter', () => {
  const policy: KubeResource = {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'NetworkPolicy',
    metadata: { name: 'allow-web', namespace: 'shop', labels: { app: 'allow-web' }, annotations: { owner: 'team-a' } },
    spec: {
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
      egress: [{ to: [{ namespaceSelector: { matchLabels: { env: 'prod' } } }], ports: [{ protocol: 'UDP', port: 'dns', endPort: 5353 }] }],
    },
  }

  it('round-trips pod, namespace and CIDR peers with named and numeric ports', () => {
    const form = networkPolicyFormAdapter.fillForm(policy)
    expect(form.network.podSelector).toEqual([{ key: 'app', value: 'shop-web' }])
    expect(form.network.policyTypes).toEqual(['Ingress', 'Egress'])
    expect(form.network.ingress[0]?.peers.map((peer) => peer.type)).toEqual(['podSelector', 'namespaceSelector', 'ipBlock'])
    expect(form.network.ingress[0]?.peers[2]).toMatchObject({ cidr: '203.0.113.0/24', except: '203.0.113.9/32' })
    expect(form.network.ingress[0]?.ports[0]).toEqual({ protocol: 'TCP', port: '443', endPort: undefined })
    expect(form.network.egress[0]?.ports[0]).toEqual({ protocol: 'UDP', port: 'dns', endPort: 5353 })

    const built = networkPolicyFormAdapter.buildResource(form, policy)
    expect(built.spec).toEqual({
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
      egress: [{ to: [{ namespaceSelector: { matchLabels: { env: 'prod' } } }], ports: [{ protocol: 'UDP', port: 'dns', endPort: 5353 }] }],
    })
    expect(built.metadata.annotations).toEqual({ owner: 'team-a' })
  })

  it('builds a new policy with one ingress rule and empty egress', () => {
    const form = networkPolicyFormAdapter.createEmptyForm()
    form.name = 'default-policy'
    form.namespace = 'shop'
    form.network.podSelector = [{ key: 'app', value: 'web' }]
    form.network.ingress = [
      {
        peers: [{ type: 'ipBlock', labelKey: '', labelValue: '', cidr: '198.51.100.0/24', except: '' }],
        ports: [{ protocol: 'TCP', port: '8080' }],
      },
    ]
    expect(networkPolicyFormAdapter.buildResource(form)).toMatchObject({
      apiVersion: 'networking.k8s.io/v1',
      kind: 'NetworkPolicy',
      metadata: { name: 'default-policy', namespace: 'shop' },
      spec: {
        podSelector: { matchLabels: { app: 'web' } },
        policyTypes: ['Ingress'],
        ingress: [{ from: [{ ipBlock: { cidr: '198.51.100.0/24' } }], ports: [{ protocol: 'TCP', port: 8080 }] }],
        egress: [],
      },
    })
  })
})

describe('adapter validation', () => {
  it('shares the resource-name rule with the editor', () => {
    const form = serviceFormAdapter.createEmptyForm()
    expect(serviceFormAdapter.validate(form)).toEqual(['请输入资源名称'])
    form.name = 'Bad Name'
    expect(serviceFormAdapter.validate(form)).toEqual(['仅支持小写字母、数字和中划线，且不能以中划线开头或结尾'])
    form.name = 'shop-web'
    expect(serviceFormAdapter.validate(form)).toEqual([])
  })
})
