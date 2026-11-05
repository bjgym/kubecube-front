import { describe, expect, it } from 'vitest'
import { normalizeLogConfig, serializeLogConfig, type LogConfigDto } from '@/api/logconfig'
import type { KubeResource } from '@/types/api'

const context = { cluster: 'production-shanghai', namespace: 'online-shop' }

describe('logconfig adapter', () => {
  it('maps the Logseer DTO into the shared resource model without dropping inputs', () => {
    const dto: LogConfigDto = {
      name: 'shop-stdout',
      cluster: 'production-shanghai',
      namespace: 'online-shop',
      labelSelector: { app: ['shop-web'] },
      inputs: [{ name: 'stdout', paths: ['stdout'], containerName: 'app', multiline: { active: true, pattern: '^\\s' } }],
      createTime: '2026-01-01T00:00:00Z',
    }
    const resource = normalizeLogConfig(dto, context)
    expect(resource.metadata.name).toBe('shop-stdout')
    expect(resource.metadata.creationTimestamp).toBe('2026-01-01T00:00:00Z')
    expect(resource.spec?.inputs).toEqual(dto.inputs)
    expect(resource.spec?.labelSelector).toEqual({ app: ['shop-web'] })
  })

  it('does not double-wrap an already normalized resource', () => {
    const resource: KubeResource = { kind: 'LogConfig', metadata: { name: 'existing' }, spec: { inputs: [] } }
    expect(normalizeLogConfig(resource, context)).toBe(resource)
  })

  it('serializes advanced inputs and restores the cluster and namespace', () => {
    const resource: KubeResource = {
      kind: 'LogConfig',
      metadata: { name: 'shop-stdout', namespace: 'online-shop' },
      spec: {
        labelSelector: { app: 'shop-web' },
        inputs: [
          { paths: ['/var/log/containers'], matchFields: { metadata: ['pod'] }, fields: { source: 'container' }, excludeFiles: ['*.tmp'] },
        ],
      },
    }
    const dto = serializeLogConfig(resource, context)
    expect(dto).toMatchObject({
      name: 'shop-stdout',
      cluster: 'production-shanghai',
      namespace: 'online-shop',
      labelSelector: { app: 'shop-web' },
    })
    expect(dto.inputs?.[0]).toMatchObject({ matchFields: { metadata: ['pod'] }, excludeFiles: ['*.tmp'] })
  })
})
