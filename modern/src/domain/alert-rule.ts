export type NormalDimension = 'namespace' | 'pod' | 'container' | 'workload'
export type NormalOperation = 'and' | 'or'

export interface NormalCondition {
  record: string
  operator: string
  value: string
}

export interface NormalRule {
  perspect: 'metric'
  dimension: NormalDimension
  scope: string
  targets: string[]
  operation: NormalOperation
  conditions: NormalCondition[]
}

export const normalDimensions: Array<{ label: string; value: NormalDimension }> = [
  { label: '空间', value: 'namespace' },
  { label: '副本', value: 'pod' },
  { label: '容器', value: 'container' },
  { label: '负载', value: 'workload' },
]

export const normalOperators = ['>', '>=', '=', '!=', '<', '<=']

export function emptyNormalRule(): NormalRule {
  return {
    perspect: 'metric',
    dimension: 'pod',
    scope: 'deployment',
    targets: [],
    operation: 'or',
    conditions: [{ record: '', operator: '>', value: '' }],
  }
}

export function normalRuleExpression(rule: NormalRule): string {
  const targets = rule.targets.map((target) => target.trim()).filter(Boolean)
  const join = rule.operation === 'and' ? ' and on(target) ' : ' or '
  return rule.conditions
    .filter((condition) => condition.record.trim())
    .map((condition) => {
      const selector = targets.length ? `{target=~"${targets.join('|')}"}` : ''
      return `(${condition.record.trim()}${selector}) ${condition.operator} ${condition.value.trim()}`
    })
    .join(join)
}

export function parseExtendInfo(raw?: string): NormalRule | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<NormalRule>
    if (value.perspect !== 'metric' || !Array.isArray(value.conditions) || !value.conditions.length) return null
    return {
      perspect: 'metric',
      dimension: (value.dimension || 'pod') as NormalDimension,
      scope: value.scope || 'deployment',
      targets: Array.isArray(value.targets) ? value.targets.map(String) : [],
      operation: value.operation === 'and' ? 'and' : 'or',
      conditions: value.conditions.map((condition) => ({
        record: String(condition.record || ''),
        operator: normalOperators.includes(String(condition.operator)) ? String(condition.operator) : '>',
        value: String(condition.value || ''),
      })),
    }
  } catch {
    return null
  }
}
