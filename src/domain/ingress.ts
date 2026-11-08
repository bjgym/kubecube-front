export interface IngressPathForm {
  path: string
  pathType: 'Prefix' | 'Exact' | 'ImplementationSpecific'
  serviceName: string
  servicePort: number
}

export interface IngressRuleForm {
  host: string
  paths: IngressPathForm[]
}

export interface IngressTlsForm {
  hosts: string
  secretName: string
}

export interface IngressSpecInput {
  className: string
  rules: IngressRuleForm[]
  tls: IngressTlsForm[]
  editing: boolean
}

export function mergeIngressSpec(spec: Record<string, any>, input: IngressSpecInput): Record<string, any> {
  const rules = input.rules
    .filter((rule) => rule.host || rule.paths.some((path) => path.path || path.serviceName))
    .map((rule) => ({
      ...(rule.host ? { host: rule.host } : {}),
      http: {
        paths: rule.paths
          .filter((path) => path.path || path.serviceName)
          .map((path) => ({
            path: path.path || '/',
            pathType: path.pathType,
            backend: {
              service: {
                name: path.serviceName,
                port: { number: path.servicePort },
              },
            },
          })),
      },
    }))
  const tls = input.tls
    .filter((entry) => entry.secretName)
    .map((entry) => ({
      ...(entry.hosts.trim()
        ? {
            hosts: entry.hosts
              .split(',')
              .map((host) => host.trim())
              .filter(Boolean),
          }
        : {}),
      secretName: entry.secretName,
    }))
  const next: Record<string, any> = { ...spec, rules }
  const className = input.className.trim()
  if (className) next.ingressClassName = className
  else delete next.ingressClassName
  if (tls.length) next.tls = tls
  else if (input.editing) next.tls = []
  else delete next.tls
  return next
}
