import { describe, expect, it } from 'vitest'
import { emptyNormalRule, normalRuleExpression, parseExtendInfo } from '@/domain/alert-rule'

describe('normal alert rule builder', () => {
  it('builds OR and AND expressions with target selectors', () => {
    const rule = {
      ...emptyNormalRule(),
      targets: ['shop-web', 'shop-api'],
      conditions: [
        { record: 'container_cpu_usage', operator: '>', value: '0.8' },
        { record: 'container_memory_usage', operator: '>=', value: '90' },
      ],
    }
    expect(normalRuleExpression({ ...rule, operation: 'or' })).toBe(
      '(container_cpu_usage{target=~"shop-web|shop-api"}) > 0.8 or (container_memory_usage{target=~"shop-web|shop-api"}) >= 90',
    )
    expect(normalRuleExpression({ ...rule, operation: 'and' })).toContain(' and on(target) ')
  })

  it('drops empty records and omits an empty target selector', () => {
    expect(
      normalRuleExpression({
        ...emptyNormalRule(),
        conditions: [
          { record: '', operator: '>', value: '1' },
          { record: 'up', operator: '<', value: '1' },
        ],
      }),
    ).toBe('(up) < 1')
  })

  it('round-trips the legacy extendInfo annotation', () => {
    const rule = {
      ...emptyNormalRule(),
      dimension: 'workload' as const,
      targets: ['shop-web'],
      operation: 'and' as const,
      conditions: [{ record: 'kube_deployment_status_replicas_available', operator: '<', value: '1' }],
    }
    expect(parseExtendInfo(JSON.stringify(rule))).toEqual(rule)
    expect(parseExtendInfo('not-json')).toBeNull()
    expect(parseExtendInfo(JSON.stringify({ perspect: 'metric', conditions: [] }))).toBeNull()
  })
})
