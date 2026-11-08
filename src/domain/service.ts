export interface ServicePortForm {
  name: string
  port: number
  targetPort: number
  protocol: 'TCP' | 'UDP' | 'SCTP'
  nodePort?: number
}

export interface ServiceSpecInput {
  type: string
  ports: ServicePortForm[]
  selector: Record<string, string>
  editing: boolean
  headless: boolean
  externalIPs: string[]
  sessionAffinity: 'None' | 'ClientIP'
  sessionAffinitySeconds?: number
  externalName?: string
}

export function serviceSelectorFromWorkload(spec: Record<string, any>): Record<string, string> {
  const selector = spec?.selector?.matchLabels || spec?.selector || {}
  if (!selector || typeof selector !== 'object' || Array.isArray(selector)) return {}
  return Object.fromEntries(Object.entries(selector).filter(([key, value]) => key && typeof value === 'string')) as Record<string, string>
}

export function mergeServiceSpec(spec: Record<string, any>, input: ServiceSpecInput): Record<string, any> {
  const selector = Object.fromEntries(Object.entries(input.selector).filter(([key]) => key))
  const next: Record<string, any> = {
    ...spec,
    type: input.type,
    ports: input.ports
      .filter((port) => port.port)
      .map((port) => ({
        ...(port.name ? { name: port.name } : {}),
        port: port.port,
        targetPort: port.targetPort || port.port,
        protocol: port.protocol,
        ...(input.type === 'NodePort' && port.nodePort ? { nodePort: port.nodePort } : {}),
      })),
    sessionAffinity: input.sessionAffinity,
    ...(input.sessionAffinity === 'ClientIP' && input.sessionAffinitySeconds
      ? { sessionAffinityConfig: { clientIP: { timeoutSeconds: input.sessionAffinitySeconds } } }
      : { sessionAffinityConfig: undefined }),
  }
  if (input.headless) next.clusterIP = 'None'
  if (input.type === 'ExternalName' && input.externalName) next.externalName = input.externalName
  else delete next.externalName
  if (input.externalIPs.length) next.externalIPs = input.externalIPs
  else delete next.externalIPs
  if (input.type === 'ExternalName') delete next.selector
  else if (Object.keys(selector).length || input.editing) next.selector = selector
  else delete next.selector
  if (!next.sessionAffinityConfig) delete next.sessionAffinityConfig
  return next
}
