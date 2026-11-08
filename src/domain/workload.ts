export type ContainerKind = 'normal' | 'init'
export type EnvSource = 'value' | 'secretKeyRef' | 'configMapKeyRef' | 'fieldRef' | 'resourceFieldRef'
export type ProbeMethod = 'httpGet' | 'tcpSocket' | 'exec'
export type VolumeType = 'persistentVolumeClaim' | 'configMap' | 'secret' | 'emptyDir' | 'hostPath' | 'other'

export interface KeyValue {
  key: string
  value: string
}

export interface ContainerPortForm {
  name: string
  port: number
  protocol: 'TCP' | 'UDP' | 'SCTP'
}

export interface EnvVarForm {
  name: string
  source: EnvSource
  value: string
  refName: string
  refKey: string
  optional: boolean
}

export interface VolumeMountForm {
  volumeName: string
  mountPath: string
  subPath: string
  readOnly: boolean
}

export interface PodVolumeForm {
  name: string
  type: VolumeType
  source: string
  medium: string
  sizeLimit: string
  hostPathType: string
  readOnly: boolean
  optional: boolean
  raw: Record<string, unknown>
}

export interface ProbeForm {
  enabled: boolean
  method: ProbeMethod
  host: string
  path: string
  port: number
  command: string
  initialDelaySeconds: number
  periodSeconds: number
  timeoutSeconds: number
  failureThreshold: number
  successThreshold: number
}

export interface ContainerForm {
  name: string
  image: string
  imagePullPolicy: string
  kind: ContainerKind
  ports: ContainerPortForm[]
  cpuRequest: string
  cpuLimit: string
  memoryRequest: string
  memoryLimit: string
  env: EnvVarForm[]
  mounts: VolumeMountForm[]
  command: string
  args: string
  liveness: ProbeForm
  readiness: ProbeForm
  startup: ProbeForm
}

export interface TolerationForm {
  key: string
  operator: 'Equal' | 'Exists'
  value: string
  effect: '' | 'NoSchedule' | 'PreferNoSchedule' | 'NoExecute'
}

export interface AffinityExpressionForm {
  key: string
  operator: 'In' | 'NotIn' | 'Exists' | 'DoesNotExist' | 'Gt' | 'Lt'
  value: string
}

export interface AffinityTermForm {
  expressions: AffinityExpressionForm[]
  topologyKey: string
  namespace: string
}

export function newAffinityTerm(topologyKey = 'kubernetes.io/hostname'): AffinityTermForm {
  return {
    expressions: [{ key: '', operator: 'In', value: '' }],
    topologyKey,
    namespace: '',
  }
}

export function newProbe(): ProbeForm {
  return {
    enabled: false,
    method: 'httpGet',
    host: '',
    path: '/healthz',
    port: 8080,
    command: '',
    initialDelaySeconds: 10,
    periodSeconds: 10,
    timeoutSeconds: 3,
    failureThreshold: 3,
    successThreshold: 1,
  }
}

export function newContainer(index = 1, kind: ContainerKind = 'normal'): ContainerForm {
  return {
    name: kind === 'init' ? `init-${index}` : `container-${index}`,
    image: '',
    imagePullPolicy: 'IfNotPresent',
    kind,
    ports: [{ name: 'http', port: 8080, protocol: 'TCP' }],
    cpuRequest: '500m',
    cpuLimit: '1',
    memoryRequest: '512Mi',
    memoryLimit: '1Gi',
    env: [],
    mounts: [],
    command: '',
    args: '',
    liveness: newProbe(),
    readiness: newProbe(),
    startup: newProbe(),
  }
}

export function lines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

export function buildEnv(rows: EnvVarForm[]): Array<Record<string, unknown>> {
  return rows
    .filter((row) => row.name)
    .map((row) => {
      if (row.source === 'value') return { name: row.name, value: row.value }
      if (row.source === 'fieldRef') return { name: row.name, valueFrom: { fieldRef: { fieldPath: row.refKey } } }
      if (row.source === 'resourceFieldRef') return { name: row.name, valueFrom: { resourceFieldRef: { resource: row.refKey } } }
      const ref = { name: row.refName, key: row.refKey, optional: row.optional }
      return { name: row.name, valueFrom: row.source === 'secretKeyRef' ? { secretKeyRef: ref } : { configMapKeyRef: ref } }
    })
}

export function buildProbe(probe: ProbeForm): Record<string, unknown> | undefined {
  if (!probe.enabled) return undefined
  const timing = {
    initialDelaySeconds: probe.initialDelaySeconds,
    periodSeconds: probe.periodSeconds,
    timeoutSeconds: probe.timeoutSeconds,
    failureThreshold: probe.failureThreshold,
    successThreshold: probe.successThreshold,
  }
  if (probe.method === 'exec') return { ...timing, exec: { command: lines(probe.command) } }
  if (probe.method === 'tcpSocket') return { ...timing, tcpSocket: { host: probe.host || undefined, port: probe.port } }
  return { ...timing, httpGet: { host: probe.host || undefined, path: probe.path, port: probe.port } }
}

export function buildContainer(container: ContainerForm, existing?: Record<string, any>): Record<string, unknown> {
  const resources = existing?.resources || {}
  const next: Record<string, any> = {
    ...existing,
    name: container.name,
    image: container.image,
    imagePullPolicy: container.imagePullPolicy || 'IfNotPresent',
    ports: container.ports
      .filter((port) => port.port)
      .map((port) => ({ name: port.name || undefined, containerPort: port.port, protocol: port.protocol })),
    resources: {
      ...resources,
      requests: {
        ...resources.requests,
        ...(container.cpuRequest ? { cpu: container.cpuRequest } : {}),
        ...(container.memoryRequest ? { memory: container.memoryRequest } : {}),
      },
      limits: {
        ...resources.limits,
        ...(container.cpuLimit ? { cpu: container.cpuLimit } : {}),
        ...(container.memoryLimit ? { memory: container.memoryLimit } : {}),
      },
    },
  }
  if (container.env.length) next.env = buildEnv(container.env)
  else if (existing?.env) next.env = []
  if (container.mounts.length)
    next.volumeMounts = container.mounts
      .filter((mount) => mount.volumeName && mount.mountPath)
      .map((mount) => ({
        name: mount.volumeName,
        mountPath: mount.mountPath,
        ...(mount.subPath ? { subPath: mount.subPath } : {}),
        ...(mount.readOnly ? { readOnly: true } : {}),
      }))
  else if (existing?.volumeMounts) next.volumeMounts = []
  if (lines(container.command).length) next.command = lines(container.command)
  else delete next.command
  if (lines(container.args).length) next.args = lines(container.args)
  else delete next.args
  delete next.livenessProbe
  delete next.readinessProbe
  delete next.startupProbe
  const liveness = buildProbe(container.liveness)
  const readiness = buildProbe(container.readiness)
  const startup = buildProbe(container.startup)
  if (liveness) next.livenessProbe = liveness
  if (readiness) next.readinessProbe = readiness
  if (startup) next.startupProbe = startup
  return next
}

export interface VolumeClaimTemplateForm {
  name: string
  storageClassName: string
  storage: string
  accessMode: 'ReadWriteOnce' | 'ReadOnlyMany' | 'ReadWriteMany'
}

export interface WorkloadPodForm {
  volumes: PodVolumeForm[]
  volumeClaimTemplates: VolumeClaimTemplateForm[]
  imagePullSecrets: string[]
  nodeSelector: KeyValue[]
  tolerations: TolerationForm[]
  nodeAffinity: AffinityTermForm[]
  podAffinity: AffinityTermForm[]
  podAntiAffinity: AffinityTermForm[]
  hostNetwork: boolean
  strategyType: 'RollingUpdate' | 'Recreate'
  maxUnavailable: string
  maxSurge: string
  updateType: 'RollingUpdate' | 'OnDelete'
  partition: number
  jobCompletions?: number
  jobParallelism?: number
  jobBackoffLimit?: number
  jobActiveDeadlineSeconds?: number
  cronConcurrencyPolicy: 'Allow' | 'Forbid' | 'Replace'
  cronSuspend: boolean
  cronSuccessfulHistoryLimit: number
  cronFailedHistoryLimit: number
}

export function newWorkloadPodForm(): WorkloadPodForm {
  return {
    volumes: [],
    volumeClaimTemplates: [],
    imagePullSecrets: [],
    nodeSelector: [],
    tolerations: [],
    nodeAffinity: [],
    podAffinity: [],
    podAntiAffinity: [],
    hostNetwork: false,
    strategyType: 'RollingUpdate',
    maxUnavailable: '25%',
    maxSurge: '25%',
    updateType: 'RollingUpdate',
    partition: 0,
    jobBackoffLimit: 6,
    cronConcurrencyPolicy: 'Allow',
    cronSuspend: false,
    cronSuccessfulHistoryLimit: 3,
    cronFailedHistoryLimit: 1,
  }
}

export function buildPodVolumes(rows: PodVolumeForm[]): Array<Record<string, unknown>> {
  return rows
    .filter((row) => row.name)
    .map((row) => {
      const base = { name: row.name }
      if (row.type === 'persistentVolumeClaim') return { ...base, persistentVolumeClaim: { claimName: row.source, readOnly: row.readOnly } }
      if (row.type === 'configMap') return { ...base, configMap: { name: row.source, optional: row.optional } }
      if (row.type === 'secret') return { ...base, secret: { secretName: row.source, optional: row.optional } }
      if (row.type === 'emptyDir')
        return {
          ...base,
          emptyDir: { ...(row.medium ? { medium: row.medium } : {}), ...(row.sizeLimit ? { sizeLimit: row.sizeLimit } : {}) },
        }
      if (row.type === 'hostPath') return { ...base, hostPath: { path: row.source, type: row.hostPathType || 'DirectoryOrCreate' } }
      return { ...base, ...row.raw }
    })
}

export function toToleration(rows: TolerationForm[]): Array<Record<string, unknown>> {
  return rows
    .filter((row) => row.key || row.operator === 'Exists')
    .map((row) => ({
      ...(row.key ? { key: row.key } : {}),
      operator: row.operator,
      ...(row.operator === 'Equal' && row.value ? { value: row.value } : {}),
      ...(row.effect ? { effect: row.effect } : {}),
    }))
}

function expressionsToKube(term: AffinityTermForm) {
  return term.expressions
    .filter((expression) => expression.key)
    .map((expression) => ({
      key: expression.key,
      operator: expression.operator,
      ...(['In', 'NotIn', 'Gt', 'Lt'].includes(expression.operator) ? { values: expression.value.split(/[\s,]+/).filter(Boolean) } : {}),
    }))
}

function podTermsToKube(terms: AffinityTermForm[]) {
  return terms
    .filter((term) => term.expressions.some((expression) => expression.key))
    .map((term) => ({
      labelSelector: { matchExpressions: expressionsToKube(term) },
      topologyKey: term.topologyKey || 'kubernetes.io/hostname',
      ...(term.namespace ? { namespaces: [term.namespace] } : {}),
    }))
}

export function buildAffinity(form: WorkloadPodForm): Record<string, unknown> | undefined {
  const nodeTerms = form.nodeAffinity
    .filter((term) => term.expressions.some((expression) => expression.key))
    .map((term) => ({ matchExpressions: expressionsToKube(term) }))
  const podAffinity = podTermsToKube(form.podAffinity)
  const podAntiAffinity = podTermsToKube(form.podAntiAffinity)
  if (!nodeTerms.length && !podAffinity.length && !podAntiAffinity.length) return undefined
  return {
    ...(nodeTerms.length ? { nodeAffinity: { requiredDuringSchedulingIgnoredDuringExecution: { nodeSelectorTerms: nodeTerms } } } : {}),
    ...(podAffinity.length ? { podAffinity: { requiredDuringSchedulingIgnoredDuringExecution: podAffinity } } : {}),
    ...(podAntiAffinity.length ? { podAntiAffinity: { requiredDuringSchedulingIgnoredDuringExecution: podAntiAffinity } } : {}),
  }
}

function probeToForm(probe: Record<string, any> | undefined): ProbeForm {
  const base = newProbe()
  if (!probe) return base
  const method: ProbeMethod = probe.exec ? 'exec' : probe.tcpSocket ? 'tcpSocket' : 'httpGet'
  const source = method === 'exec' ? probe.exec : method === 'tcpSocket' ? probe.tcpSocket : probe.httpGet || {}
  return {
    enabled: true,
    method,
    host: String(source.host || ''),
    path: String(source.path || '/healthz'),
    port: Number(source.port || 8080),
    command: Array.isArray(probe.exec?.command) ? probe.exec.command.join('\n') : '',
    initialDelaySeconds: Number(probe.initialDelaySeconds ?? 10),
    periodSeconds: Number(probe.periodSeconds ?? 10),
    timeoutSeconds: Number(probe.timeoutSeconds ?? 3),
    failureThreshold: Number(probe.failureThreshold ?? 3),
    successThreshold: Number(probe.successThreshold ?? 1),
  }
}

export function containerToForm(item: Record<string, any>, kind: ContainerKind): ContainerForm {
  const base = newContainer(1, kind)
  const env = Array.isArray(item.env) ? item.env : []
  return {
    ...base,
    name: String(item.name || ''),
    image: String(item.image || ''),
    imagePullPolicy: String(item.imagePullPolicy || 'IfNotPresent'),
    kind,
    ports:
      Array.isArray(item.ports) && item.ports.length
        ? item.ports.map((port: Record<string, any>) => ({
            name: String(port.name || ''),
            port: Number(port.containerPort || 0),
            protocol: port.protocol || 'TCP',
          }))
        : [],
    cpuRequest: String(item.resources?.requests?.cpu || ''),
    cpuLimit: String(item.resources?.limits?.cpu || ''),
    memoryRequest: String(item.resources?.requests?.memory || ''),
    memoryLimit: String(item.resources?.limits?.memory || ''),
    env: env.map((entry: Record<string, any>) => {
      const valueFrom = entry.valueFrom || {}
      const source: EnvSource = valueFrom.secretKeyRef
        ? 'secretKeyRef'
        : valueFrom.configMapKeyRef
          ? 'configMapKeyRef'
          : valueFrom.fieldRef
            ? 'fieldRef'
            : valueFrom.resourceFieldRef
              ? 'resourceFieldRef'
              : 'value'
      const ref = valueFrom.secretKeyRef || valueFrom.configMapKeyRef || {}
      return {
        name: String(entry.name || ''),
        source,
        value: String(entry.value || ''),
        refName: String(ref.name || ''),
        refKey: String(ref.key || valueFrom.fieldRef?.fieldPath || valueFrom.resourceFieldRef?.resource || ''),
        optional: Boolean(ref.optional),
      }
    }),
    mounts: (Array.isArray(item.volumeMounts) ? item.volumeMounts : []).map((mount: Record<string, any>) => ({
      volumeName: String(mount.name || ''),
      mountPath: String(mount.mountPath || ''),
      subPath: String(mount.subPath || ''),
      readOnly: Boolean(mount.readOnly),
    })),
    command: Array.isArray(item.command) ? item.command.join('\n') : '',
    args: Array.isArray(item.args) ? item.args.join('\n') : '',
    liveness: probeToForm(item.livenessProbe),
    readiness: probeToForm(item.readinessProbe),
    startup: probeToForm(item.startupProbe),
  }
}

export function podFormFromSpec(
  spec: Record<string, any> | undefined,
  workloadSpec: Record<string, any> | undefined,
  configKey: string,
): WorkloadPodForm {
  const model = newWorkloadPodForm()
  if (!spec) return model
  model.imagePullSecrets = (Array.isArray(spec.imagePullSecrets) ? spec.imagePullSecrets : []).map((item: Record<string, any>) =>
    String(item.name || ''),
  )
  model.nodeSelector = Object.entries((spec.nodeSelector || {}) as Record<string, string>).map(([key, value]) => ({ key, value }))
  model.tolerations = (Array.isArray(spec.tolerations) ? spec.tolerations : []).map((item: Record<string, any>) => ({
    key: String(item.key || ''),
    operator: item.operator === 'Exists' ? 'Exists' : 'Equal',
    value: String(item.value || ''),
    effect: item.effect || '',
  }))
  model.hostNetwork = Boolean(spec.hostNetwork)
  const affinity = spec.affinity || {}
  model.nodeAffinity = affinityFromSpec(affinity.nodeAffinity?.requiredDuringSchedulingIgnoredDuringExecution?.nodeSelectorTerms)
  model.podAffinity = affinityFromSpec(affinity.podAffinity?.requiredDuringSchedulingIgnoredDuringExecution)
  model.podAntiAffinity = affinityFromSpec(affinity.podAntiAffinity?.requiredDuringSchedulingIgnoredDuringExecution)
  model.volumes = (Array.isArray(spec.volumes) ? spec.volumes : []).map((volume: Record<string, any>) => {
    if (volume.persistentVolumeClaim)
      return {
        ...baseVolume(volume.name),
        type: 'persistentVolumeClaim',
        source: String(volume.persistentVolumeClaim.claimName || ''),
        readOnly: Boolean(volume.persistentVolumeClaim.readOnly),
      }
    if (volume.configMap)
      return {
        ...baseVolume(volume.name),
        type: 'configMap',
        source: String(volume.configMap.name || ''),
        optional: Boolean(volume.configMap.optional),
      }
    if (volume.secret)
      return {
        ...baseVolume(volume.name),
        type: 'secret',
        source: String(volume.secret.secretName || ''),
        optional: Boolean(volume.secret.optional),
      }
    if (volume.emptyDir)
      return {
        ...baseVolume(volume.name),
        type: 'emptyDir',
        medium: String(volume.emptyDir.medium || ''),
        sizeLimit: String(volume.emptyDir.sizeLimit || ''),
      }
    if (volume.hostPath)
      return {
        ...baseVolume(volume.name),
        type: 'hostPath',
        source: String(volume.hostPath.path || ''),
        hostPathType: String(volume.hostPath.type || 'DirectoryOrCreate'),
      }
    const { name: _name, ...raw } = volume
    return { ...baseVolume(volume.name), type: 'other', raw }
  })
  model.volumeClaimTemplates = (Array.isArray(workloadSpec?.volumeClaimTemplates) ? workloadSpec.volumeClaimTemplates : []).map(
    (template: Record<string, any>) => ({
      name: String(template.metadata?.name || ''),
      storageClassName: String(template.spec?.storageClassName || ''),
      storage: String(template.spec?.resources?.requests?.storage || '10Gi'),
      accessMode: template.spec?.accessModes?.[0] || 'ReadWriteOnce',
    }),
  )
  if (configKey === 'deployments') {
    const strategy = workloadSpec?.strategy || {}
    model.strategyType = strategy.type === 'Recreate' ? 'Recreate' : 'RollingUpdate'
    model.maxUnavailable = String(strategy.rollingUpdate?.maxUnavailable || '25%')
    model.maxSurge = String(strategy.rollingUpdate?.maxSurge || '25%')
  }
  if (configKey === 'statefulsets' || configKey === 'daemonsets') {
    const strategy = workloadSpec?.updateStrategy || {}
    model.updateType = strategy.type === 'OnDelete' ? 'OnDelete' : 'RollingUpdate'
    model.partition = Number(strategy.rollingUpdate?.partition || 0)
  }
  if (configKey === 'jobs') {
    model.jobCompletions = workloadSpec?.completions
    model.jobParallelism = workloadSpec?.parallelism
    model.jobBackoffLimit = workloadSpec?.backoffLimit
    model.jobActiveDeadlineSeconds = workloadSpec?.activeDeadlineSeconds
  }
  if (configKey === 'cronjobs') {
    const jobSpec = workloadSpec?.jobTemplate?.spec || {}
    model.jobCompletions = jobSpec.completions
    model.jobParallelism = jobSpec.parallelism
    model.jobBackoffLimit = jobSpec.backoffLimit
    model.jobActiveDeadlineSeconds = jobSpec.activeDeadlineSeconds
    model.cronConcurrencyPolicy = workloadSpec?.concurrencyPolicy || 'Allow'
    model.cronSuspend = Boolean(workloadSpec?.suspend)
    model.cronSuccessfulHistoryLimit = Number(workloadSpec?.successfulJobsHistoryLimit ?? 3)
    model.cronFailedHistoryLimit = Number(workloadSpec?.failedJobsHistoryLimit ?? 1)
  }
  return model
}

function baseVolume(name: string): PodVolumeForm {
  return {
    name: String(name || ''),
    type: 'other',
    source: '',
    medium: '',
    sizeLimit: '',
    hostPathType: 'DirectoryOrCreate',
    readOnly: false,
    optional: false,
    raw: {},
  }
}

function expressionsFromKube(expressions: Array<Record<string, any>> | undefined): AffinityExpressionForm[] {
  return (Array.isArray(expressions) ? expressions : []).map((expression) => ({
    key: String(expression.key || ''),
    operator: ['In', 'NotIn', 'Exists', 'DoesNotExist', 'Gt', 'Lt'].includes(expression.operator) ? expression.operator : 'In',
    value: Array.isArray(expression.values) ? expression.values.join(' ') : '',
  }))
}

function affinityFromSpec(terms: Array<Record<string, any>> | undefined): AffinityTermForm[] {
  return (Array.isArray(terms) ? terms : []).map((term) => ({
    expressions: expressionsFromKube(term.labelSelector?.matchExpressions || term.matchExpressions),
    topologyKey: String(term.topologyKey || 'kubernetes.io/hostname'),
    namespace: String(term.namespaces?.[0] || ''),
  }))
}
