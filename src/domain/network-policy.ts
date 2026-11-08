export type PolicyPeerType = 'podSelector' | 'namespaceSelector' | 'ipBlock'
export type PolicyDirection = 'ingress' | 'egress'

export interface PolicyPeerForm {
  type: PolicyPeerType
  labelKey: string
  labelValue: string
  cidr: string
  except: string
}

export interface PolicyPortForm {
  protocol: 'TCP' | 'UDP' | 'SCTP'
  port: string
  endPort?: number
}

export interface PolicyRuleForm {
  peers: PolicyPeerForm[]
  ports: PolicyPortForm[]
}

export interface NetworkPolicyForm {
  podSelector: Array<{ key: string; value: string }>
  policyTypes: Array<'Ingress' | 'Egress'>
  ingress: PolicyRuleForm[]
  egress: PolicyRuleForm[]
}

export function newPeer(type: PolicyPeerType = 'podSelector'): PolicyPeerForm {
  return { type, labelKey: '', labelValue: '', cidr: '', except: '' }
}

export function newPolicyRule(): PolicyRuleForm {
  return { peers: [], ports: [] }
}

export function newNetworkPolicyForm(): NetworkPolicyForm {
  return {
    podSelector: [],
    policyTypes: ['Ingress'],
    ingress: [],
    egress: [],
  }
}

function pairMap(rows: Array<{ key: string; value: string }>) {
  return Object.fromEntries(rows.filter((row) => row.key).map((row) => [row.key, row.value]))
}

function peerToKube(peer: PolicyPeerForm): Record<string, unknown> | undefined {
  if (peer.type === 'ipBlock') {
    if (!peer.cidr.trim()) return undefined
    return {
      ipBlock: {
        cidr: peer.cidr.trim(),
        ...(peer.except.trim()
          ? {
              except: peer.except
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean),
            }
          : {}),
      },
    }
  }
  const labels = peer.labelKey ? { matchLabels: { [peer.labelKey]: peer.labelValue } } : undefined
  if (!labels) return undefined
  return peer.type === 'namespaceSelector' ? { namespaceSelector: labels } : { podSelector: labels }
}

function ruleToKube(rule: PolicyRuleForm, direction: PolicyDirection): Record<string, unknown> {
  const peers = rule.peers.map(peerToKube).filter(Boolean)
  const ports = rule.ports
    .filter((port) => port.port)
    .map((port) => ({
      protocol: port.protocol,
      port: /^\d+$/.test(port.port) ? Number(port.port) : port.port,
      ...(port.endPort ? { endPort: port.endPort } : {}),
    }))
  return {
    ...(peers.length ? { [direction === 'ingress' ? 'from' : 'to']: peers } : {}),
    ...(ports.length ? { ports } : {}),
  }
}

export function mergeNetworkPolicySpec(spec: Record<string, any>, form: NetworkPolicyForm): Record<string, any> {
  const ingress = form.ingress.map((rule) => ruleToKube(rule, 'ingress')).filter((rule) => Object.keys(rule).length)
  const egress = form.egress.map((rule) => ruleToKube(rule, 'egress')).filter((rule) => Object.keys(rule).length)
  return {
    ...spec,
    podSelector: { matchLabels: pairMap(form.podSelector) },
    policyTypes: [...form.policyTypes],
    ...(ingress.length ? { ingress } : {}),
    ...(egress.length ? { egress } : {}),
    ...(!ingress.length ? { ingress: [] } : {}),
    ...(!egress.length ? { egress: [] } : {}),
  }
}

export function networkPolicyToForm(spec: Record<string, any> | undefined): NetworkPolicyForm {
  const form = newNetworkPolicyForm()
  if (!spec) return form
  form.podSelector = Object.entries((spec.podSelector?.matchLabels || {}) as Record<string, string>).map(([key, value]) => ({
    key,
    value,
  }))
  form.policyTypes = Array.isArray(spec.policyTypes) ? spec.policyTypes : ['Ingress']
  const parseRules = (rules: unknown): PolicyRuleForm[] =>
    (Array.isArray(rules) ? rules : []).map((rule: Record<string, any>) => {
      const peerKey = rule.from ? 'from' : rule.to ? 'to' : ''
      const peers = (Array.isArray(rule[peerKey]) ? rule[peerKey] : []).map((peer: Record<string, any>) => {
        if (peer.ipBlock)
          return {
            type: 'ipBlock' as const,
            labelKey: '',
            labelValue: '',
            cidr: String(peer.ipBlock.cidr || ''),
            except: (peer.ipBlock.except || []).join(', '),
          }
        const selector = peer.namespaceSelector || peer.podSelector || {}
        const labels = (selector.matchLabels || {}) as Record<string, string>
        const [labelKey = '', labelValue = ''] = Object.entries(labels)[0] || []
        return {
          type: peer.namespaceSelector ? ('namespaceSelector' as const) : ('podSelector' as const),
          labelKey,
          labelValue,
          cidr: '',
          except: '',
        }
      })
      const ports = (Array.isArray(rule.ports) ? rule.ports : []).map((port: Record<string, any>) => ({
        protocol: port.protocol || 'TCP',
        port: String(port.port ?? ''),
        endPort: port.endPort,
      }))
      return { peers, ports }
    })
  form.ingress = parseRules(spec.ingress)
  form.egress = parseRules(spec.egress)
  return form
}
