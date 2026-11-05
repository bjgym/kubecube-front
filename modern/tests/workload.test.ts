import { describe, expect, it } from 'vitest'
import {
  buildAffinity,
  buildContainer,
  buildEnv,
  buildPodVolumes,
  buildProbe,
  containerToForm,
  newContainer,
  newProbe,
  newWorkloadPodForm,
  podFormFromSpec,
  toToleration,
  type EnvVarForm,
  type PodVolumeForm,
} from '@/domain/workload'

describe('workload serialization', () => {
  it('serializes every supported environment-variable source', () => {
    const rows: EnvVarForm[] = [
      { name: 'PLAIN', source: 'value', value: 'on', refName: '', refKey: '', optional: false },
      { name: 'SECRET', source: 'secretKeyRef', value: '', refName: 'db', refKey: 'password', optional: true },
      { name: 'CONFIG', source: 'configMapKeyRef', value: '', refName: 'app', refKey: 'mode', optional: false },
      { name: 'POD_NAME', source: 'fieldRef', value: '', refName: '', refKey: 'metadata.name', optional: false },
      { name: 'CPU', source: 'resourceFieldRef', value: '', refName: '', refKey: 'limits.cpu', optional: false },
    ]
    expect(buildEnv(rows)).toEqual([
      { name: 'PLAIN', value: 'on' },
      { name: 'SECRET', valueFrom: { secretKeyRef: { name: 'db', key: 'password', optional: true } } },
      { name: 'CONFIG', valueFrom: { configMapKeyRef: { name: 'app', key: 'mode', optional: false } } },
      { name: 'POD_NAME', valueFrom: { fieldRef: { fieldPath: 'metadata.name' } } },
      { name: 'CPU', valueFrom: { resourceFieldRef: { resource: 'limits.cpu' } } },
    ])
  })

  it('builds HTTP, TCP and exec probes', () => {
    const probe = { ...newProbe(), enabled: true, method: 'httpGet' as const, path: '/ready', port: 8080 }
    expect(buildProbe(probe)).toMatchObject({ httpGet: { path: '/ready', port: 8080 }, periodSeconds: 10 })
    expect(buildProbe({ ...probe, method: 'tcpSocket', port: 9000 })).toMatchObject({ tcpSocket: { port: 9000 } })
    expect(buildProbe({ ...probe, method: 'exec', command: 'cat /tmp/ok\nfalse' })).toMatchObject({
      exec: { command: ['cat /tmp/ok', 'false'] },
    })
    expect(buildProbe({ ...probe, enabled: false })).toBeUndefined()
  })

  it('clears env, mounts, commands and probes that were removed from an edited container', () => {
    const existing = {
      name: 'app',
      image: 'old',
      env: [{ name: 'OLD', value: '1' }],
      volumeMounts: [{ name: 'data', mountPath: '/data' }],
      command: ['/bin/old'],
      livenessProbe: { exec: { command: ['true'] } },
    }
    const result = buildContainer({ ...newContainer(1), name: 'app', image: 'new' }, existing)
    expect(result).toMatchObject({ name: 'app', image: 'new', env: [], volumeMounts: [] })
    expect(result).not.toHaveProperty('command')
    expect(result).not.toHaveProperty('livenessProbe')
  })

  it('serializes Pod volumes and preserves unsupported raw volume types', () => {
    const rows: PodVolumeForm[] = [
      {
        name: 'data',
        type: 'persistentVolumeClaim',
        source: 'pvc',
        medium: '',
        sizeLimit: '',
        hostPathType: '',
        readOnly: true,
        optional: false,
        raw: {},
      },
      {
        name: 'config',
        type: 'configMap',
        source: 'app',
        medium: '',
        sizeLimit: '',
        hostPathType: '',
        readOnly: false,
        optional: false,
        raw: {},
      },
      {
        name: 'tmp',
        type: 'emptyDir',
        source: '',
        medium: 'Memory',
        sizeLimit: '64Mi',
        hostPathType: '',
        readOnly: false,
        optional: false,
        raw: {},
      },
      {
        name: 'host',
        type: 'hostPath',
        source: '/var/log',
        medium: '',
        sizeLimit: '',
        hostPathType: 'Directory',
        readOnly: false,
        optional: false,
        raw: {},
      },
      {
        name: 'downward',
        type: 'other',
        source: '',
        medium: '',
        sizeLimit: '',
        hostPathType: '',
        readOnly: false,
        optional: false,
        raw: { downwardAPI: { items: [] } },
      },
    ]
    expect(buildPodVolumes(rows)).toEqual([
      { name: 'data', persistentVolumeClaim: { claimName: 'pvc', readOnly: true } },
      { name: 'config', configMap: { name: 'app', optional: false } },
      { name: 'tmp', emptyDir: { medium: 'Memory', sizeLimit: '64Mi' } },
      { name: 'host', hostPath: { path: '/var/log', type: 'Directory' } },
      { name: 'downward', downwardAPI: { items: [] } },
    ])
  })

  it('omits values from Exists tolerations', () => {
    expect(
      toToleration([
        { key: 'gpu', operator: 'Equal', value: 'true', effect: 'NoSchedule' },
        { key: 'maintenance', operator: 'Exists', value: 'ignored', effect: '' },
      ]),
    ).toEqual([
      { key: 'gpu', operator: 'Equal', value: 'true', effect: 'NoSchedule' },
      { key: 'maintenance', operator: 'Exists' },
    ])
  })

  it('loads existing containers and Pod settings without losing fields', () => {
    const container = containerToForm(
      {
        name: 'app',
        image: 'shop:v2',
        imagePullPolicy: 'Always',
        command: ['/bin/sh', '-c'],
        args: ['serve'],
        ports: [{ name: 'http', containerPort: 8080, protocol: 'TCP' }],
        env: [
          { name: 'DATABASE_URL', value: 'postgres://db' },
          { name: 'TOKEN', valueFrom: { secretKeyRef: { name: 'api', key: 'token', optional: true } } },
        ],
        volumeMounts: [{ name: 'data', mountPath: '/data', subPath: 'shop', readOnly: true }],
        livenessProbe: { httpGet: { path: '/live', port: 8080 }, periodSeconds: 7 },
        resources: { requests: { cpu: '100m', memory: '128Mi' }, limits: { cpu: '500m', memory: '512Mi' } },
      },
      'normal',
    )
    expect(container).toMatchObject({
      name: 'app',
      image: 'shop:v2',
      imagePullPolicy: 'Always',
      command: '/bin/sh\n-c',
      args: 'serve',
      cpuRequest: '100m',
      cpuLimit: '500m',
    })
    expect(container.env[1]).toMatchObject({ name: 'TOKEN', source: 'secretKeyRef', refName: 'api', refKey: 'token', optional: true })
    expect(container.mounts[0]).toEqual({ volumeName: 'data', mountPath: '/data', subPath: 'shop', readOnly: true })
    expect(container.liveness).toMatchObject({ enabled: true, method: 'httpGet', path: '/live', periodSeconds: 7 })

    const pod = podFormFromSpec(
      {
        imagePullSecrets: [{ name: 'regcred' }],
        nodeSelector: { 'node-pool': 'gpu' },
        hostNetwork: true,
        tolerations: [{ key: 'gpu', operator: 'Equal', value: 'true', effect: 'NoSchedule' }],
        volumes: [{ name: 'data', persistentVolumeClaim: { claimName: 'shop-data', readOnly: true } }],
      },
      { strategy: { type: 'RollingUpdate', rollingUpdate: { maxUnavailable: '10%', maxSurge: '1' } } },
      'deployments',
    )
    expect(pod).toMatchObject({
      imagePullSecrets: ['regcred'],
      nodeSelector: [{ key: 'node-pool', value: 'gpu' }],
      hostNetwork: true,
      maxUnavailable: '10%',
      maxSurge: '1',
    })
    expect(pod.volumes[0]).toMatchObject({ name: 'data', type: 'persistentVolumeClaim', source: 'shop-data', readOnly: true })
  })

  it('serializes node, pod and anti-affinity required rules', () => {
    const form = newWorkloadPodForm()
    form.nodeAffinity = [
      { expressions: [{ key: 'topology.kubernetes.io/zone', operator: 'In', value: 'east west' }], topologyKey: '', namespace: '' },
    ]
    form.podAffinity = [
      {
        expressions: [{ key: 'app', operator: 'In', value: 'cache' }],
        topologyKey: 'kubernetes.io/hostname',
        namespace: 'shop',
      },
    ]
    form.podAntiAffinity = [
      {
        expressions: [{ key: 'app', operator: 'In', value: 'shop-web' }],
        topologyKey: 'kubernetes.io/hostname',
        namespace: '',
      },
    ]
    expect(buildAffinity(form)).toEqual({
      nodeAffinity: {
        requiredDuringSchedulingIgnoredDuringExecution: {
          nodeSelectorTerms: [
            {
              matchExpressions: [{ key: 'topology.kubernetes.io/zone', operator: 'In', values: ['east', 'west'] }],
            },
          ],
        },
      },
      podAffinity: {
        requiredDuringSchedulingIgnoredDuringExecution: [
          {
            labelSelector: { matchExpressions: [{ key: 'app', operator: 'In', values: ['cache'] }] },
            topologyKey: 'kubernetes.io/hostname',
            namespaces: ['shop'],
          },
        ],
      },
      podAntiAffinity: {
        requiredDuringSchedulingIgnoredDuringExecution: [
          {
            labelSelector: { matchExpressions: [{ key: 'app', operator: 'In', values: ['shop-web'] }] },
            topologyKey: 'kubernetes.io/hostname',
          },
        ],
      },
    })
  })
})
