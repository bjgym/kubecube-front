import { describe, expect, it } from 'vitest'
import { fromYAML, toYAML, validateYAML } from '@/utils/yaml'

describe('YAML utilities', () => {
  it('round-trips a Kubernetes resource', () => {
    const resource = { apiVersion: 'v1', kind: 'ConfigMap', metadata: { name: 'app-config' }, data: { message: '你好' } }
    expect(fromYAML(toYAML(resource))).toEqual(resource)
  })
  it('rejects empty and scalar resources', () => {
    expect(validateYAML('')).toBe('YAML 内容不能为空')
    expect(validateYAML('just a string')).toBe('请输入有效的 Kubernetes 资源对象')
  })
  it('accepts a valid object', () => {
    expect(validateYAML('apiVersion: v1\nkind: Pod\nmetadata:\n  name: test')).toBeNull()
  })
})
