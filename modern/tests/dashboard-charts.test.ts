import { describe, expect, it } from 'vitest'
import type { ChartDefinition, ChartState, DynamicPanel } from '@/views/control/dashboard/parser'
import {
  SERIES_PALETTE,
  axisValue,
  chartOption,
  formatMetric,
  statLink,
  tableCell,
  tableColumnLabel,
  tableLink,
} from '@/views/control/dashboard/charts'

const cpuDefinition: ChartDefinition = {
  key: 'cpu',
  title: 'CPU 使用量',
  description: '关联容器的 CPU 使用速率',
  footer: '单位：Core',
  unit: 'cpu',
  queries: [],
}

const singleSeriesState: ChartState = {
  series: [{ name: 'web-1', values: [[1720000000000, 0.5]] }],
  loading: false,
  error: '',
}

function createPanel(overrides: Partial<DynamicPanel> = {}): DynamicPanel {
  return {
    id: 'row-0-panel-2',
    type: 'table',
    title: '容器资源概览',
    span: 12,
    unit: 'count',
    targets: [],
    state: { series: [], loading: false, error: '' },
    tableRows: [],
    tableColumns: [],
    tableStyles: [],
    tableUnits: {},
    stats: [],
    stack: false,
    linkUrl: '',
    ...overrides,
  }
}

describe('chart formatting', () => {
  it('formats CPU cores and milli-cores', () => {
    expect(formatMetric(0.25, 'cpu')).toEqual({ value: '250', unit: 'mCore' })
    expect(formatMetric(2.5, 'cpu')).toEqual({ value: '2.5', unit: 'Core' })
    expect(formatMetric(0, 'cpu')).toEqual({ value: '0', unit: 'Core' })
  })

  it('formats memory, throughput, rate, duration and percent units', () => {
    expect(formatMetric(1536, 'memory')).toEqual({ value: '1.5 KB', unit: '' })
    expect(formatMetric(1048576, 'bytesPerSecond')).toEqual({ value: '1 MB/s', unit: '' })
    expect(formatMetric(12.5, 'requestsPerSecond')).toEqual({ value: '12.5', unit: 'req/s' })
    expect(formatMetric(42, 'seconds')).toEqual({ value: '42', unit: 's' })
    expect(formatMetric(0.125, 'percent')).toEqual({ value: '12.5', unit: '%' })
    expect(formatMetric(7, 'count')).toEqual({ value: '7', unit: '个' })
  })

  it('renders a dash for missing values', () => {
    expect(formatMetric(null, 'cpu')).toEqual({ value: '—', unit: '' })
    expect(formatMetric(Number.NaN, 'cpu')).toEqual({ value: '—', unit: '' })
  })

  it('formats axis ticks with the chart unit', () => {
    expect(axisValue(1536, 'memory')).toBe('1.5 KB')
    expect(axisValue(2048, 'bytesPerSecond')).toBe('2 KB/s')
    expect(axisValue(0.5, 'cpu')).toBe('500m')
    expect(axisValue(2, 'cpu')).toBe('2')
    expect(axisValue(0.5, 'percent')).toBe('50%')
    expect(axisValue(30, 'seconds')).toBe('30s')
    expect(axisValue(0.25, 'requestsPerSecond')).toBe('0.25')
    expect(axisValue(3, 'count')).toBe('3')
  })
})

describe('chart option builder', () => {
  it('builds a line chart with the shared palette and a single-series area fill', () => {
    const option = chartOption(cpuDefinition, singleSeriesState)
    expect(option.animation).toBe(false)
    expect(option.color).toEqual(SERIES_PALETTE)
    const series = option.series as Array<Record<string, any>>
    expect(series).toHaveLength(1)
    expect(series[0]).toMatchObject({
      name: 'web-1',
      type: 'line',
      smooth: true,
      showSymbol: false,
      connectNulls: false,
      lineStyle: { width: 2, color: '#5b6cff' },
      itemStyle: { color: '#5b6cff' },
      areaStyle: { opacity: 0.12 },
    })
    expect(series[0]!.stack).toBeUndefined()
  })

  it('uses a lighter area fill for multi-series charts and honours explicit colours', () => {
    const option = chartOption(cpuDefinition, {
      series: [
        { name: 'a', values: [[1, 1]] },
        { name: 'b', color: '#f04438', values: [[1, 2]] },
      ],
      loading: false,
      error: '',
    })
    const series = option.series as Array<Record<string, any>>
    expect(series[0]!.areaStyle).toEqual({ opacity: 0.05 })
    expect(series[1]!.lineStyle.color).toBe('#f04438')
    expect(series[1]!.itemStyle.color).toBe('#f04438')
  })

  it('stacks dynamic panels and applies their axis bounds', () => {
    const panel = createPanel({ stack: true, axisMin: 0, axisMax: 4 })
    const option = chartOption(cpuDefinition, singleSeriesState, panel)
    expect((option.series as Array<Record<string, any>>)[0]!.stack).toBe('total')
    const yAxis = option.yAxis as Record<string, any>
    expect(yAxis.min).toBe(0)
    expect(yAxis.max).toBe(4)
  })

  it('clamps the default y-axis minimum at zero', () => {
    const yAxis = chartOption(cpuDefinition, singleSeriesState).yAxis as Record<string, any>
    expect(typeof yAxis.min).toBe('function')
    expect(yAxis.min({ min: -3 })).toBe(-3)
    expect(yAxis.min({ min: 2 })).toBe(0)
    expect(yAxis.max).toBeUndefined()
  })

  it('formats tooltip values with the chart unit', () => {
    const tooltip = chartOption(cpuDefinition, singleSeriesState).tooltip as Record<string, any>
    expect(tooltip.trigger).toBe('axis')
    expect(tooltip.confine).toBe(true)
    expect(tooltip.valueFormatter(0.5)).toBe('500m')
    expect(tooltip.valueFormatter('n/a')).toBe('n/a')
    expect(tooltip.valueFormatter(null)).toBe('—')
  })

  it('renders a time x-axis', () => {
    const option = chartOption(cpuDefinition, singleSeriesState)
    expect((option.xAxis as Record<string, any>).type).toBe('time')
    expect((option.grid as Record<string, any>).containLabel).toBe(true)
  })
})

describe('table formatting', () => {
  const panel = createPanel({
    unit: 'count',
    targets: [{ name: 'CPU', query: '', legend: '', ref: 'A', instant: true }],
    tableUnits: { 'CPU 使用量': 'cpu' },
    tableStyles: [{ alias: 'Pod', pattern: 'pod', unit: 'count', link: true, linkUrl: '/control/pods/$__cell/monitor' }],
  })

  it('labels table columns with their keys', () => {
    expect(tableColumnLabel(panel, 'Pod')).toBe('Pod')
  })

  it('formats value columns with the column unit', () => {
    expect(tableCell(panel, 'CPU 使用量', { 'CPU 使用量': 0.25 })).toBe('250 mCore')
    expect(tableCell(panel, 'A', { A: '1.5' })).toBe('1.5 个')
  })

  it('renders label columns verbatim', () => {
    expect(tableCell(panel, 'Pod', { Pod: 'web-1' })).toBe('web-1')
  })

  it('renders a dash for empty cells and passes through non-numeric values', () => {
    expect(tableCell(panel, 'Pod', {})).toBe('—')
    expect(tableCell(panel, 'Pod', { Pod: '' })).toBe('—')
    expect(tableCell(panel, 'Pod', { Pod: null })).toBe('—')
    expect(tableCell(panel, 'A', { A: 'oops' })).toBe('oops')
  })

  it('resolves table cell links through the __cell placeholder', () => {
    expect(tableLink(panel, 'Pod', { Pod: 'web-1' }, {})).toBe('/control/pods/web-1/monitor')
    expect(tableLink(panel, 'CPU 使用量', { 'CPU 使用量': 0.25 }, {})).toBe('')
    expect(tableLink(createPanel(), 'Pod', { Pod: 'web-1' }, {})).toBe('')
  })

  it('resolves single stat links through the __cell placeholder', () => {
    expect(statLink(createPanel({ linkUrl: '/control/pods/$__cell/monitor' }), 3, {})).toBe('/control/pods/3/monitor')
    expect(statLink(createPanel(), 3, {})).toBe('')
  })
})
