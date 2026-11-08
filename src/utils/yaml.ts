import { parse, stringify } from 'yaml'

export function toYAML(value: unknown): string {
  return stringify(value, { indent: 2, lineWidth: 0 })
}

export function fromYAML<T = unknown>(content: string): T {
  return parse(content) as T
}

export function validateYAML(content: string): string | null {
  if (!content.trim()) return 'YAML 内容不能为空'
  try {
    const value = parse(content)
    if (!value || typeof value !== 'object') return '请输入有效的 Kubernetes 资源对象'
    return null
  } catch (error) {
    return error instanceof Error ? error.message : 'YAML 格式不正确'
  }
}
