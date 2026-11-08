import { describe, expect, it } from 'vitest'
import {
  applyVariables,
  buildDashboardContextValues,
  buildVariableOptions,
  createChartStates,
  createMetricStates,
  hasDashboardRows,
  labelValues,
  normalizeUnit,
  parseLabelValuesRequest,
  parseRows,
  parseVariables,
  selectVariableValue,
  seriesLabelValues,
  visibleRows,
  type DashboardSpec,
} from '@/views/control/dashboard/parser'

/**
 * Fixture modelled on the real `cube-resource-namespace` Dashboard CR shipped by
 * kubecube-monitoring: one overview row with a single stat, a graph and a table,
 * plus a second row with defaults.
 */
const namespaceDashboard: DashboardSpec = {
  title: 'cube-resource-namespace',
  selectshowable: 'true',
  variables: [
    {
      query: {
        name: 'namespace',
        label: '命名空间',
        request: 'label_values(kube_pod_info, namespace)',
        datasource: 'prometheus',
      },
    },
    {
      query: {
        name: 'pod',
        label: 'Pod',
        request: 'label_values(kube_pod_info{namespace=~"$namespace"}, pod)',
        includeAll: true,
      },
    },
    { name: 'legacy' },
    { query: { label: '无名称变量' } },
  ],
  rows: [
    {
      name: '资源概览',
      panels: [
        {
          singleStat: {
            title: 'CPU 配额',
            unit: 'cores',
            span: 6,
            targets: [
              {
                prometheus: {
                  query: 'kube_resourcequota{cluster="prod",namespace="$namespace",resource="requests.cpu",type="used"}',
                  instant: true,
                  legend: 'Requests',
                },
              },
              { prometheus: { query: '', legend: '空查询' } },
            ],
          },
        },
        {
          graph: {
            title: '内存使用量(WSS)',
            span: 12,
            stack: true,
            axes: { left: { unit: 'bytes', min: '0', max: '1073741824' } },
            targets: [
              {
                prometheus: {
                  query: 'sum(container_memory_working_set_bytes{namespace=~"$namespace", container!="", image!=""}) by (pod)',
                  legend: '{{pod}}',
                },
              },
            ],
          },
        },
        {
          table: {
            title: '容器资源概览',
            span: 12,
            targets: [
              {
                prometheus: {
                  query: 'sum(rate(container_cpu_usage_seconds_total{namespace=~"$namespace"}[5m])) by (pod)',
                  ref: 'A',
                  instant: true,
                },
              },
              {
                prometheus: {
                  query: 'sum(kube_pod_container_resource_requests{namespace=~"$namespace", resource="cpu"}) by (pod)',
                  ref: 'B',
                  instant: true,
                },
              },
            ],
            styles: [
              { pattern: 'pod', alias: 'Pod', link: true, linkUrl: '/control/pods/$__cell/monitor' },
              { pattern: 'Value #A', alias: 'CPU 使用量' },
              { pattern: 'Value #B', alias: 'CPU Requests', unit: 'cores' },
              { pattern: 'Value #C', alias: 'CPU 使用率(/Requests)', unit: 'percentunit' },
            ],
          },
        },
        { graph: { title: '隐藏面板', hidden: true, targets: [{ prometheus: { query: 'up' } }] } },
        { text: { title: '不支持的类型' } },
      ],
    },
    {
      title: '默认行名',
      panels: [
        { singleStat: { targets: [{ prometheus: { query: 'up', legend: '实例健康' } }] } },
        { graph: { title: '超宽图表', span: 99, targets: [{ prometheus: { query: 'up' } }] } },
      ],
    },
  ],
}

describe('dashboard parser variables', () => {
  it('parses name, label, request and includeAll from the CR', () => {
    expect(parseVariables(namespaceDashboard)).toEqual([
      { name: 'namespace', label: '命名空间', request: 'label_values(kube_pod_info, namespace)', includeAll: false },
      {
        name: 'pod',
        label: 'Pod',
        request: 'label_values(kube_pod_info{namespace=~"$namespace"}, pod)',
        includeAll: true,
      },
      { name: 'legacy', label: 'legacy', request: '', includeAll: false },
    ])
  })

  it('ignores variables without a name', () => {
    expect(parseVariables({ variables: [{ query: { label: '无名称' } }] })).toEqual([])
    expect(parseVariables({})).toEqual([])
  })

  it('accepts the string form of includeAll used in older CRs', () => {
    expect(parseVariables({ variables: [{ query: { name: 'cluster', includeAll: 'true' } }] })[0]?.includeAll).toBe(true)
  })
})

describe('dashboard parser rows', () => {
  it('maps graph/table/singleStat panels and skips hidden or unsupported ones', () => {
    const rows = parseRows(namespaceDashboard)
    expect(rows).toHaveLength(2)
    expect(rows[0]!.name).toBe('资源概览')
    expect(rows[1]!.name).toBe('默认行名')
    expect(rows[0]!.panels.map((panel) => panel.type)).toEqual(['singleStat', 'graph', 'table'])
    expect(rows[0]!.panels.map((panel) => panel.id)).toEqual(['row-0-panel-0', 'row-0-panel-1', 'row-0-panel-2'])
  })

  it('parses a singleStat panel: title, span, unit, target legend and instant flag', () => {
    const panel = parseRows(namespaceDashboard)[0]!.panels[0]!
    expect(panel).toMatchObject({ type: 'singleStat', title: 'CPU 配额', span: 6, unit: 'cpu', stack: false, linkUrl: '' })
    expect(panel.targets).toEqual([
      {
        name: 'Requests',
        query: 'kube_resourcequota{cluster="prod",namespace="$namespace",resource="requests.cpu",type="used"}',
        legend: 'Requests',
        ref: 'A',
        instant: true,
      },
    ])
  })

  it('parses a graph panel: stack, axis bounds and legend template', () => {
    const panel = parseRows(namespaceDashboard)[0]!.panels[1]!
    expect(panel).toMatchObject({ type: 'graph', title: '内存使用量(WSS)', span: 12, unit: 'memory', stack: true })
    expect(panel.axisMin).toBe(0)
    expect(panel.axisMax).toBe(1073741824)
    expect(panel.targets).toEqual([
      {
        name: '{{pod}}',
        query: 'sum(container_memory_working_set_bytes{namespace=~"$namespace", container!="", image!=""}) by (pod)',
        legend: '{{pod}}',
        ref: 'A',
        instant: false,
      },
    ])
  })

  it('parses a table panel: style aliases, per-column units and target refs', () => {
    const panel = parseRows(namespaceDashboard)[0]!.panels[2]!
    expect(panel).toMatchObject({ type: 'table', title: '容器资源概览', span: 12, unit: 'count' })
    expect(panel.targets.map((target) => target.ref)).toEqual(['A', 'B'])
    expect(panel.tableStyles).toEqual([
      { alias: 'Pod', pattern: 'pod', unit: 'count', link: true, linkUrl: '/control/pods/$__cell/monitor' },
      { alias: 'CPU 使用量', pattern: 'Value #A', unit: 'count', link: false, linkUrl: '' },
      { alias: 'CPU Requests', pattern: 'Value #B', unit: 'cpu', link: false, linkUrl: '' },
      { alias: 'CPU 使用率(/Requests)', pattern: 'Value #C', unit: 'percent', link: false, linkUrl: '' },
    ])
    expect(panel.tableUnits).toEqual({ Pod: 'count', 'CPU 使用量': 'count', 'CPU Requests': 'cpu', 'CPU 使用率(/Requests)': 'percent' })
  })

  it('applies default titles, spans and row names', () => {
    const panel = parseRows(namespaceDashboard)[1]!.panels[0]!
    expect(panel).toMatchObject({ type: 'singleStat', title: '指标', span: 2, unit: 'count' })
    expect(panel.targets[0]).toMatchObject({ name: '实例健康', ref: 'A', instant: false })
  })

  it('clamps panel spans into the 12-column grid', () => {
    expect(parseRows(namespaceDashboard)[1]!.panels[1]!.span).toBe(12)
  })

  it('returns empty rows for a spec without rows', () => {
    expect(parseRows({})).toEqual([])
    expect(parseRows({ rows: [{ name: '空行' }] })).toEqual([{ name: '空行', panels: [] }])
  })
})

describe('dashboard parser row visibility', () => {
  const rows = parseRows(namespaceDashboard)

  it('keeps every row visible when no panel is hidden', () => {
    expect(visibleRows(rows, {})).toHaveLength(2)
  })

  it('removes hidden panels from their row without mutating the source rows', () => {
    const visible = visibleRows(rows, { 'row-0-panel-0': false })
    expect(visible[0]!.panels.map((panel) => panel.id)).toEqual(['row-0-panel-1', 'row-0-panel-2'])
    expect(rows[0]!.panels).toHaveLength(3)
  })

  it('drops rows whose panels are all hidden', () => {
    const visible = visibleRows(rows, { 'row-1-panel-0': false, 'row-1-panel-1': false })
    expect(visible.map((row) => row.name)).toEqual(['资源概览'])
  })

  it('reports whether any row carries a renderable panel', () => {
    expect(hasDashboardRows(rows)).toBe(true)
    expect(hasDashboardRows([{ name: '空行', panels: [] }])).toBe(false)
    expect(hasDashboardRows([])).toBe(false)
  })
})

describe('dashboard parser context and template variables', () => {
  const values = buildDashboardContextValues({
    tenant: 'retail',
    project: 'shop',
    cluster: 'prod',
    namespace: 'online',
    instance: 'web-1',
    workload: 'deployments',
    node: '',
    variables: {},
  })

  it('maps the monitoring context to the Dashboard template keys', () => {
    expect(values).toEqual({
      tenant: 'retail',
      project: 'shop',
      cluster: 'prod',
      namespace: 'online',
      workload: 'web-1',
      pod: 'web-1',
      volume: 'web-1',
      type: 'deployment',
      node: '',
    })
  })

  it('lets Dashboard variable values override the context', () => {
    const overridden = buildDashboardContextValues({
      tenant: 'retail',
      project: 'shop',
      cluster: 'prod',
      namespace: 'online',
      instance: 'web-1',
      workload: 'deployments',
      node: '',
      variables: { namespace: 'shop-online', pod: 'web-2' },
    })
    expect(overridden.namespace).toBe('shop-online')
    expect(overridden.pod).toBe('web-2')
  })

  it('replaces [[name]], ${name} and $name placeholders', () => {
    expect(applyVariables('sum(rate(container_cpu_usage_seconds_total{cluster="$cluster", namespace="$namespace"}[5m]))', values)).toBe(
      'sum(rate(container_cpu_usage_seconds_total{cluster="prod", namespace="online"}[5m]))',
    )
    expect(applyVariables('[[cluster]]/${project}/$tenant', values)).toBe('prod/shop/retail')
  })

  it('turns unknown placeholders into empty strings', () => {
    expect(applyVariables('$unknown/$pod', values)).toBe('/web-1')
    expect(applyVariables('', values)).toBe('')
  })

  it('supports one-off values such as table cell links', () => {
    expect(applyVariables('/control/pods/$__cell/monitor', values, { __cell: 'web-1' })).toBe('/control/pods/web-1/monitor')
  })
})

describe('dashboard parser label_values requests', () => {
  it('parses a metric + label request', () => {
    expect(parseLabelValuesRequest('label_values(up, instance)')).toEqual({ metric: 'up', label: 'instance' })
    expect(parseLabelValuesRequest('label_values(prometheus_build_info{cluster=~"$cluster", job=~"$job"}, instance)')).toEqual({
      metric: 'prometheus_build_info{cluster=~"$cluster", job=~"$job"}',
      label: 'instance',
    })
  })

  it('parses a label-only request', () => {
    expect(parseLabelValuesRequest('label_values(instance)')).toEqual({ metric: '', label: 'instance' })
  })

  it('rejects requests that are not label_values()', () => {
    expect(parseLabelValuesRequest('sum(rate(http_requests_total[5m]))')).toBeNull()
    expect(parseLabelValuesRequest('label_values()')).toBeNull()
    expect(parseLabelValuesRequest('  label_values(up, instance)  ')).toBeNull()
  })

  it('reads values from a /api/v1/series response', () => {
    const response = {
      status: 'success',
      data: [
        { instance: '10.0.0.1:9090', job: 'prometheus' },
        { instance: '10.0.0.2:9090', job: 'prometheus' },
        { instance: '10.0.0.1:9090', job: 'prometheus' },
        { job: 'kubelet' },
      ],
    }
    expect(seriesLabelValues(response, 'instance')).toEqual(['10.0.0.1:9090', '10.0.0.2:9090'])
    expect(seriesLabelValues(response, 'job')).toEqual(['prometheus', 'kubelet'])
    expect(seriesLabelValues({}, 'instance')).toEqual([])
  })

  it('reads values from a /api/v1/label/<label>/values response', () => {
    expect(labelValues({ status: 'success', data: ['web-1', 'web-2', 'web-1', ''] })).toEqual(['web-1', 'web-2'])
    expect(labelValues({ data: { data: [{ value: 'kube-system' }, { value: 'default' }] } })).toEqual(['kube-system', 'default'])
    expect(labelValues({})).toEqual([])
  })

  it('prepends the all option only when requested and missing', () => {
    expect(buildVariableOptions(['a', 'b'], false)).toEqual(['a', 'b'])
    expect(buildVariableOptions(['a', 'b'], true)).toEqual(['.*', 'a', 'b'])
    expect(buildVariableOptions(['.*', 'a'], true)).toEqual(['.*', 'a'])
  })

  it('selects the context value, the first real option or the all option', () => {
    expect(selectVariableValue(['a', 'b'], 'b', false)).toBe('b')
    expect(selectVariableValue(['.*', 'a', 'b'], '.*', true)).toBe('.*')
    expect(selectVariableValue(['a', 'b'], 'missing', false)).toBe('a')
    expect(selectVariableValue(['.*', 'a'], 'missing', true)).toBe('a')
    expect(selectVariableValue(['.*'], 'missing', true)).toBe('.*')
    expect(selectVariableValue([], 'missing', false)).toBe('missing')
  })
})

describe('dashboard parser units and initial state', () => {
  it.each([
    ['percentunit', 'percent'],
    ['percent', 'percent'],
    ['%', 'percent'],
    ['byte', 'memory'],
    ['bytes', 'memory'],
    ['decbytes', 'memory'],
    ['Bps', 'bytesPerSecond'],
    ['binBps', 'bytesPerSecond'],
    ['pps', 'requestsPerSecond'],
    ['reqps', 'requestsPerSecond'],
    ['cores', 'cpu'],
    ['cpu', 'cpu'],
    ['s', 'seconds'],
    ['seconds', 'seconds'],
    [undefined, 'count'],
    ['fileDescriptors', 'count'],
  ])('normalizes %s to %s', (raw, expected) => {
    expect(normalizeUnit(raw)).toBe(expected)
  })

  it('creates empty chart and metric states', () => {
    expect(createChartStates()).toEqual({
      cpu: { series: [], loading: false, error: '' },
      memory: { series: [], loading: false, error: '' },
      network: { series: [], loading: false, error: '' },
      capacity: { series: [], loading: false, error: '' },
    })
    expect(createMetricStates()).toEqual({
      cpu: { value: null, error: '' },
      memory: { value: null, error: '' },
      network: { value: null, error: '' },
      available: { value: null, error: '' },
    })
  })
})
