import { describe, expect, it } from 'vitest'
import type { DashboardTableStyle, DashboardTarget } from '@/views/control/dashboard/parser'
import {
  baseLabels,
  buildChartDefinitions,
  buildMetricDefinitions,
  escapePrometheus,
  escapeRegex,
  instantValue,
  prometheusLabels,
  queryStep,
  resultSeries,
  tableFromResponses,
  type PrometheusContext,
} from '@/views/control/dashboard/prometheus'

const namespaceContext: PrometheusContext = {
  contextKind: 'namespace',
  cluster: 'prod',
  namespace: 'online',
  workload: '',
  instance: '',
  node: '',
}
const workloadContext: PrometheusContext = {
  contextKind: 'workload',
  cluster: 'prod',
  namespace: 'online',
  workload: 'deployments',
  instance: 'web',
  node: '',
}
const podWorkloadContext: PrometheusContext = { ...workloadContext, workload: 'pods', instance: 'web-1' }
const clusterContext: PrometheusContext = {
  contextKind: 'cluster',
  cluster: 'prod',
  namespace: '',
  workload: '',
  instance: '',
  node: 'node-1',
}
const componentContext: PrometheusContext = {
  contextKind: 'component',
  cluster: 'prod',
  namespace: '',
  workload: '',
  instance: '',
  node: '',
}

describe('prometheus escaping', () => {
  it('escapes double quotes and backslashes inside label values', () => {
    expect(escapePrometheus('prod"west')).toBe('prod\\"west')
    expect(escapePrometheus('C:\\var\\log')).toBe('C:\\\\var\\\\log')
    expect(escapePrometheus('plain-value')).toBe('plain-value')
  })

  it('escapes PromQL regex metacharacters', () => {
    expect(escapeRegex('web.*')).toBe('web\\.\\*')
    expect(escapeRegex('a+b(c)[d]')).toBe('a\\+b\\(c\\)\\[d\\]')
    expect(escapeRegex('web-1')).toBe('web-1')
  })

  it('keeps escaped values inside the generated matchers', () => {
    const escapedContext: PrometheusContext = { ...namespaceContext, cluster: 'prod"west', namespace: 'a\\b' }
    expect(baseLabels(escapedContext)).toEqual(['cluster="prod\\"west"', 'namespace="a\\\\b"'])
    const regexContext: PrometheusContext = { ...workloadContext, instance: 'web.*' }
    expect(baseLabels(regexContext)).toContain('pod=~"^web\\.\\*(-.*)?$"')
  })
})

describe('prometheus label matchers', () => {
  it('builds namespace-scoped matchers', () => {
    expect(baseLabels(namespaceContext)).toEqual(['cluster="prod"', 'namespace="online"'])
    expect(prometheusLabels(namespaceContext)).toBe('{cluster="prod",namespace="online"}')
  })

  it('builds workload matchers for deployments and pods', () => {
    expect(baseLabels(workloadContext)).toEqual(['cluster="prod"', 'namespace="online"', 'pod=~"^web(-.*)?$"'])
    expect(baseLabels(podWorkloadContext)).toEqual(['cluster="prod"', 'namespace="online"', 'pod="web-1"'])
  })

  it('builds cluster/node matchers without a namespace', () => {
    expect(baseLabels(clusterContext)).toEqual(['cluster="prod"', 'instance=~"^node-1(:.*)?$"'])
    expect(baseLabels(componentContext)).toEqual(['cluster="prod"'])
  })

  it('merges extra matchers after the base ones', () => {
    expect(prometheusLabels(namespaceContext, 'container!=""', 'image!=""')).toBe(
      '{cluster="prod",namespace="online",container!="",image!=""}',
    )
    expect(prometheusLabels(clusterContext, 'mode!="idle"')).toBe('{cluster="prod",instance=~"^node-1(:.*)?$",mode!="idle"}')
  })
})

describe('prometheus query construction', () => {
  it('builds the four built-in charts for a namespace', () => {
    const charts = buildChartDefinitions(namespaceContext)
    expect(charts.map((chart) => chart.key)).toEqual(['cpu', 'memory', 'network', 'capacity'])
    expect(charts.map((chart) => chart.unit)).toEqual(['cpu', 'memory', 'bytesPerSecond', 'cpu'])
    expect(charts[0]!.queries[0]!.query).toBe(
      'sum(rate(container_cpu_usage_seconds_total{cluster="prod",namespace="online",container!="",image!=""}[5m]))',
    )
    expect(charts[1]!.queries[0]!.query).toBe(
      'sum(container_memory_working_set_bytes{cluster="prod",namespace="online",container!="",image!=""})',
    )
    expect(charts[2]!.queries.map((query) => query.name)).toEqual(['接收', '发送'])
    expect(charts[2]!.queries[0]!.query).toBe('sum(rate(container_network_receive_bytes_total{cluster="prod",namespace="online"}[5m]))')
    expect(charts[3]!.queries[0]!.query).toBe('sum(kube_pod_container_resource_requests{cluster="prod",namespace="online",resource="cpu"})')
  })

  it('builds node-exporter based charts for a cluster', () => {
    const charts = buildChartDefinitions(clusterContext)
    expect(charts[0]!.queries[0]!.query).toBe(
      'sum(rate(node_cpu_seconds_total{cluster="prod",instance=~"^node-1(:.*)?$",mode!="idle"}[5m]))',
    )
    expect(charts[1]!.queries[0]!.query).toBe(
      'sum(node_memory_MemTotal_bytes{cluster="prod",instance=~"^node-1(:.*)?$"}) - sum(node_memory_MemAvailable_bytes{cluster="prod",instance=~"^node-1(:.*)?$"})',
    )
    expect(charts[2]!.queries[0]!.query).toContain('device!~"lo|veth.*|docker.*|cni.*|flannel.*"')
  })

  it('builds process based charts for a platform component', () => {
    const charts = buildChartDefinitions(componentContext)
    expect(charts[0]!.queries[0]!.query).toBe('sum(rate(process_cpu_seconds_total{cluster="prod"}[5m]))')
    expect(charts[2]!.queries[1]!.query).toBe('sum(rate(http_requests_total{cluster="prod",code=~"5.."}[5m]))')
    expect(charts[3]!.unit).toBe('fileDescriptors')
    expect(charts[3]!.queries.map((query) => query.query)).toEqual([
      'sum(process_open_fds{cluster="prod"})',
      'sum(process_max_fds{cluster="prod"})',
    ])
  })

  it('derives the metric cards from the trend chart queries', () => {
    const charts = buildChartDefinitions(namespaceContext)
    const metrics = buildMetricDefinitions(namespaceContext, charts)
    expect(metrics.map((metric) => metric.key)).toEqual(['cpu', 'memory', 'network', 'available'])
    expect(metrics[0]!.query).toBe(charts[0]!.queries[0]!.query)
    expect(metrics[1]!.query).toBe(charts[1]!.queries[0]!.query)
    expect(metrics[2]!.query).toBe(`(${charts[2]!.queries[0]!.query}) + (${charts[2]!.queries[1]!.query})`)
    expect(metrics[2]!.unit).toBe('bytesPerSecond')
    expect(metrics[3]!.query).toBe('count(kube_pod_info{cluster="prod",namespace="online"})')
    expect(metrics[3]!.label).toBe('关联 Pods')
  })

  it('uses node and process specific metric card queries', () => {
    const clusterMetrics = buildMetricDefinitions(clusterContext, buildChartDefinitions(clusterContext))
    expect(clusterMetrics[3]!.query).toBe('count(kube_node_info{cluster="prod",instance=~"^node-1(:.*)?$"})')
    expect(clusterMetrics[3]!.label).toBe('节点数量')
    const componentMetrics = buildMetricDefinitions(componentContext, buildChartDefinitions(componentContext))
    expect(componentMetrics[2]!.query).toBe('sum(rate(http_requests_total{cluster="prod"}[5m]))')
    expect(componentMetrics[2]!.unit).toBe('requestsPerSecond')
    expect(componentMetrics[3]!.query).toBe('sum(up{cluster="prod"})')
    expect(componentMetrics[3]!.label).toBe('健康组件实例')
  })

  it('computes the range query step, never below 15 seconds', () => {
    expect(queryStep(60_000)).toBe(15)
    expect(queryStep(15 * 60_000)).toBe(15)
    expect(queryStep(30 * 60_000)).toBe(15)
    expect(queryStep(60 * 60_000)).toBe(30)
    expect(queryStep(24 * 60 * 60_000)).toBe(720)
    expect(queryStep(7 * 24 * 60 * 60_000)).toBe(5040)
  })
})

describe('prometheus series conversion', () => {
  const matrixResponse = {
    status: 'success',
    data: {
      resultType: 'matrix',
      result: [
        {
          metric: { pod: 'web-1', namespace: 'online' },
          values: [
            [1720000000, '0.12'],
            [1720000060, '0.15'],
          ],
        },
        { metric: { container: 'app' }, values: [[1720000000, '0.5']] },
      ],
    },
  }
  const cpuDefinition = { name: 'CPU 使用', query: 'sum(rate(container_cpu_usage_seconds_total[5m]))', color: '#5b6cff' }

  it('converts matrix timestamps to milliseconds and disambiguates series names', () => {
    const series = resultSeries(matrixResponse, cpuDefinition)
    expect(series).toEqual([
      {
        name: 'CPU 使用 · web-1',
        color: undefined,
        values: [
          [1720000000000, 0.12],
          [1720000060000, 0.15],
        ],
      },
      { name: 'CPU 使用 · app', color: undefined, values: [[1720000000000, 0.5]] },
    ])
  })

  it('resolves a legend template and keeps the definition colour for a single series', () => {
    const response = {
      data: { resultType: 'matrix', result: [{ metric: { pod: 'web-1' }, values: [[1720000000, '0.12']] }] },
    }
    expect(resultSeries(response, { name: '{{pod}}', query: '', color: '#12b76a' })).toEqual([
      { name: 'web-1', color: '#12b76a', values: [[1720000000000, 0.12]] },
    ])
  })

  it('falls back to the identity label when a legend template resolves empty', () => {
    const response = { data: { resultType: 'matrix', result: [{ metric: { job: 'kubelet' }, values: [[1720000000, '1']] }] } }
    expect(resultSeries(response, { name: '{{pod}}', query: '', color: '#2e90fa' })[0]?.name).toBe('kubelet')
  })

  it('drops malformed samples and empty series', () => {
    const response = {
      data: {
        resultType: 'matrix',
        result: [
          { metric: { pod: 'web-1' }, values: [[1720000000, '0.1'], ['not-a-time', '0.2'], [1720000060], [1720000120, 'NaN']] },
          { metric: { pod: 'web-2' }, values: [] },
        ],
      },
    }
    expect(resultSeries(response, cpuDefinition)).toEqual([{ name: 'CPU 使用 · web-1', color: undefined, values: [[1720000000000, 0.1]] }])
  })

  it('returns no series for invalid responses', () => {
    expect(resultSeries(null, cpuDefinition)).toEqual([])
    expect(resultSeries(undefined, cpuDefinition)).toEqual([])
    expect(resultSeries({}, cpuDefinition)).toEqual([])
    expect(resultSeries({ data: { result: 'oops' } }, cpuDefinition)).toEqual([])
  })
})

describe('prometheus instant conversion', () => {
  it('reads the value of a vector response', () => {
    expect(instantValue({ status: 'success', data: { resultType: 'vector', result: [{ metric: {}, value: [1720000000, '0.68'] }] } })).toBe(
      0.68,
    )
  })

  it('reads the last sample of a matrix response', () => {
    expect(
      instantValue({
        data: {
          resultType: 'matrix',
          result: [
            {
              metric: {},
              values: [
                [1720000000, '0.1'],
                [1720000060, '0.15'],
              ],
            },
          ],
        },
      }),
    ).toBe(0.15)
  })

  it('returns null when no usable value is present', () => {
    expect(instantValue(null)).toBeNull()
    expect(instantValue({})).toBeNull()
    expect(instantValue({ data: { result: [] } })).toBeNull()
    expect(instantValue({ data: { result: [{ metric: {}, value: [1720000000, 'NaN'] }] } })).toBeNull()
    expect(instantValue({ data: { result: [{}] } })).toBeNull()
  })
})

describe('prometheus table conversion', () => {
  const targets: DashboardTarget[] = [
    { name: 'CPU 使用', query: 'sum(rate(container_cpu_usage_seconds_total[5m])) by (pod)', legend: '', ref: 'A', instant: true },
    {
      name: 'CPU Requests',
      query: 'sum(kube_pod_container_resource_requests{resource="cpu"}) by (pod)',
      legend: '',
      ref: 'B',
      instant: true,
    },
  ]
  const styles: DashboardTableStyle[] = [
    { alias: 'Pod', pattern: 'pod', unit: 'count', link: true, linkUrl: '/control/pods/$__cell/monitor' },
    { alias: 'CPU 使用量', pattern: 'Value #A', unit: 'cpu', link: false, linkUrl: '' },
    { alias: 'CPU Requests', pattern: 'Value #B', unit: 'cpu', link: false, linkUrl: '' },
  ]
  const instantResponse = (values: Record<string, string>) => ({
    status: 'success',
    data: {
      resultType: 'vector',
      result: Object.entries(values).map(([pod, value]) => ({ metric: { pod }, value: [1720000000, value] })),
    },
  })

  it('merges instant responses into rows and renames columns through style aliases', () => {
    const result = tableFromResponses(
      [instantResponse({ 'web-1': '0.25', 'web-2': '0.5' }), instantResponse({ 'web-1': '0.5', 'web-2': '1.25' })],
      targets,
      styles,
    )
    expect(result.columns).toEqual(['Pod', 'CPU 使用量', 'CPU Requests'])
    expect(result.rows).toEqual([
      { pod: 'web-1', Pod: 'web-1', 'CPU 使用量': '0.25', 'CPU Requests': '0.5' },
      { pod: 'web-2', Pod: 'web-2', 'CPU 使用量': '0.5', 'CPU Requests': '1.25' },
    ])
  })

  it('takes the last sample of a range response for a table cell', () => {
    const response = {
      data: {
        resultType: 'matrix',
        result: [
          {
            metric: { pod: 'web-1' },
            values: [
              [1720000000, '0.1'],
              [1720000060, '0.4'],
            ],
          },
        ],
      },
    }
    const result = tableFromResponses([response, instantResponse({ 'web-1': '0.8' })], targets, styles)
    expect(result.rows).toEqual([{ pod: 'web-1', Pod: 'web-1', 'CPU 使用量': '0.4', 'CPU Requests': '0.8' }])
  })

  it('derives columns from the label keys and target refs when no style is defined', () => {
    const result = tableFromResponses([instantResponse({ 'web-1': '0.25' }), instantResponse({ 'web-1': '0.5' })], targets, [])
    expect(result.columns).toEqual(['pod', 'A', 'B'])
    expect(result.rows).toEqual([{ pod: 'web-1', A: '0.25', B: '0.5' }])
  })

  it('returns the style columns for empty responses', () => {
    expect(tableFromResponses([], targets, styles)).toEqual({
      rows: [],
      columns: ['Pod', 'CPU 使用量', 'CPU Requests'],
    })
    expect(tableFromResponses([], targets, []).columns).toEqual(['A', 'B'])
  })

  it('ignores responses without a result array', () => {
    expect(tableFromResponses([{ data: {} }, instantResponse({ 'web-1': '0.25' })], targets, styles).rows).toEqual([
      { pod: 'web-1', Pod: 'web-1', 'CPU Requests': '0.25' },
    ])
  })
})
