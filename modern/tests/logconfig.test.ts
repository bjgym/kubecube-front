import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  configs: vi.fn(),
  getConfig: vi.fn(),
  createConfig: vi.fn(),
  updateConfig: vi.fn(),
  deleteConfig: vi.fn(),
}))
vi.mock('@/api/logseer', () => ({ logseerApi: mocks }))

import { listLogConfigs, normalizeLogConfig, serializeLogConfig, type LogConfigDto } from '@/api/logconfig'
import type { KubeResource } from '@/types/api'

const context = { cluster: 'production-shanghai', namespace: 'online-shop' }

describe('logconfig adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.configs.mockResolvedValue({ items: [], total: 0 })
  })

  it('maps the legacy DTO without dropping advanced input fields or inventing a CRD apiVersion', () => {
    const dto: LogConfigDto = {
      name: 'shop-stdout',
      cluster: 'production-shanghai',
      namespace: 'online-shop',
      labelSelector: { app: ['shop-web'] },
      inputs: [
        {
          name: 'stdout',
          paths: ['stdout'],
          containerName: 'app',
          matchFields: { pod: ['shop-web'] },
          fields: { source: 'container' },
          multiline: { active: true, pattern: '^\\s', negate: false, match: 'after' },
          ignoreOlder: '24h',
          excludeFiles: ['*.tmp'],
          cleanLogs: { retainDays: 7, retainNum: 3 },
          enable: true,
          customOption: { preserve: true },
        },
      ],
      createTime: '2026-01-01T00:00:00Z',
    }
    const resource = normalizeLogConfig(dto, context)
    expect(resource.metadata.name).toBe('shop-stdout')
    expect(resource.metadata.creationTimestamp).toBe('2026-01-01T00:00:00Z')
    expect(resource.metadata.labels).toEqual({ app: 'shop-web' })
    expect(resource.apiVersion).toBeUndefined()
    expect(resource.spec?.inputs).toEqual(dto.inputs)
    expect(resource.spec?.labelSelector).toEqual({ app: ['shop-web'] })
  })

  it('round-trips name, labelSelector and the complete inputs collection', () => {
    const original: LogConfigDto = {
      name: 'shop-file',
      labelSelector: { app: 'shop-web' },
      inputs: [
        {
          name: 'file',
          paths: ['/var/log/app/*.log', '/var/log/audit/*.log'],
          multiline: { active: true, pattern: '^\\[', negate: true },
          cleanLogs: { retainDays: 2 },
          unknownAdvancedField: 'keep-me',
        },
      ],
    }
    const dto = serializeLogConfig(normalizeLogConfig(original, context), context)
    expect(dto.name).toBe('shop-file')
    expect(dto.labelSelector).toEqual(original.labelSelector)
    expect(dto.inputs).toEqual(original.inputs)
    expect(dto).not.toHaveProperty('type')
    expect(dto).not.toHaveProperty('path')
  })

  it('does not double-wrap an already normalized resource', () => {
    const resource: KubeResource = { kind: 'LogConfig', metadata: { name: 'existing' }, spec: { inputs: [] } }
    expect(normalizeLogConfig(resource, context)).toBe(resource)
  })

  it('serializes spec-only page resources and creates legacy inputs when necessary', () => {
    const resource: KubeResource = {
      kind: 'LogConfig',
      metadata: { name: 'shop-file', namespace: 'online-shop' },
      spec: { type: 'k8sLogfile', path: '/var/log/containers' },
    }
    const dto = serializeLogConfig(resource, context)
    expect(dto).toMatchObject({ name: 'shop-file', cluster: context.cluster, namespace: context.namespace })
    expect(dto.inputs?.[0]?.paths).toEqual(['/var/log/containers'])
    expect(dto).not.toHaveProperty('type')
    expect(dto).not.toHaveProperty('path')
  })

  it('converts shared pagination to limit/offset and preserves the legacy sort field', async () => {
    await listLogConfigs(context, {
      pageNum: 3,
      pageSize: 20,
      selector: 'metadata.name~web',
      sortName: 'metadata.creationTimestamp',
      sortOrder: 'desc',
    })
    expect(mocks.configs).toHaveBeenCalledWith({
      cluster: context.cluster,
      namespace: context.namespace,
      limit: 20,
      offset: 40,
      sortby: 'metadata.creationTimestamp',
      asc: false,
      filterby: 'name',
      filtervalue: 'web',
    })
  })
})
