/**
 * Pure formatting and ECharts option builders for the KubeCube monitoring views.
 *
 * The option builders receive the already-resolved series/panel state, so they
 * can be unit tested without a DOM. Only `DashboardView.vue` talks to echarts.
 */

import type { EChartsOption, LineSeriesOption } from 'echarts'
import type { ChartDefinition, ChartState, DynamicPanel, UnitKind } from './parser'
import { applyVariables } from './parser'
import { formatBytes, formatNumber } from '@/utils/format'

export const SERIES_PALETTE = ['#5b6cff', '#12b76a', '#2e90fa', '#f79009', '#7a5af8', '#f04438']

/** Format a metric value for cards, stats and table cells. */
export function formatMetric(value: number | null, unit: UnitKind): { value: string | number; unit: string } {
  if (value === null || !Number.isFinite(value)) return { value: '—', unit: '' }
  if (unit === 'cpu')
    return value > 0 && value < 1 ? { value: formatNumber(value * 1000), unit: 'mCore' } : { value: formatNumber(value), unit: 'Core' }
  if (unit === 'memory') return { value: formatBytes(value, 'B'), unit: '' }
  if (unit === 'bytesPerSecond') return { value: `${formatBytes(value, 'B')}/s`, unit: '' }
  if (unit === 'requestsPerSecond') return { value: formatNumber(value), unit: 'req/s' }
  if (unit === 'seconds') return { value: formatNumber(value), unit: 's' }
  if (unit === 'percent') return { value: formatNumber(value * 100, 1), unit: '%' }
  return { value: formatNumber(value), unit: '个' }
}

/** Format an axis tick for the current unit. */
export function axisValue(value: number, unit: UnitKind): string {
  if (unit === 'memory') return formatBytes(value, 'B')
  if (unit === 'bytesPerSecond') return `${formatBytes(value, 'B')}/s`
  if (unit === 'cpu' && Math.abs(value) < 1) return `${formatNumber(value * 1000)}m`
  if (unit === 'percent') return `${formatNumber(value * 100, 1)}%`
  if (unit === 'seconds') return `${formatNumber(value)}s`
  return formatNumber(value)
}

/** Build the line chart option for a trend chart or a dynamic graph panel. */
export function chartOption(definition: ChartDefinition, state: ChartState, panel?: DynamicPanel): EChartsOption {
  const palette = SERIES_PALETTE
  const series: LineSeriesOption[] = state.series.map((item, index) => ({
    name: item.name,
    type: 'line',
    data: item.values,
    smooth: true,
    showSymbol: false,
    connectNulls: false,
    stack: panel?.stack ? 'total' : undefined,
    lineStyle: { width: 2, color: item.color || palette[index % palette.length] },
    itemStyle: { color: item.color || palette[index % palette.length] },
    areaStyle: { opacity: state.series.length === 1 ? 0.12 : 0.05 },
    emphasis: { focus: 'series' },
  }))
  return {
    animation: false,
    color: palette,
    grid: { left: 18, right: 20, top: 44, bottom: 48, containLabel: true },
    legend: {
      type: 'scroll',
      top: 4,
      left: 0,
      icon: 'roundRect',
      itemWidth: 12,
      itemHeight: 4,
      textStyle: { color: '#667085', fontSize: 11 },
    },
    tooltip: {
      trigger: 'axis',
      confine: true,
      valueFormatter: (value) => (typeof value === 'number' ? axisValue(value, definition.unit) : String(value ?? '—')),
    },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: '#d0d5dd' } },
      axisLabel: { color: '#98a2b3', hideOverlap: true, formatter: '{HH}:{mm}' },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      min: panel?.axisMin ?? ((value) => Math.min(0, value.min)),
      max: panel?.axisMax,
      axisLabel: { color: '#98a2b3', formatter: (value: number) => axisValue(value, definition.unit) },
      splitLine: { lineStyle: { color: '#eaecf0', type: 'dashed' } },
    },
    series,
  }
}

/** Table column labels are the column keys themselves; kept as a seam for future aliases. */
export function tableColumnLabel(_panel: DynamicPanel, column: string): string {
  return column
}

/** Format a table cell, applying the column unit when the column holds a sample value. */
export function tableCell(panel: DynamicPanel, column: string, row: Record<string, unknown>): string {
  const raw = row[column]
  if (raw === undefined || raw === null || raw === '') return '—'
  const isValue = panel.tableUnits[column] || panel.targets.some((target) => target.ref === column)
  if (isValue) {
    const value = Number(raw)
    if (!Number.isFinite(value)) return String(raw)
    const formatted = formatMetric(value, panel.tableUnits[column] || panel.unit)
    return `${formatted.value}${formatted.unit ? ` ${formatted.unit}` : ''}`
  }
  return String(raw)
}

/** Resolve the link URL of a table cell, if its style defines one. */
export function tableLink(panel: DynamicPanel, column: string, row: Record<string, unknown>, values: Record<string, string>): string {
  const style = panel.tableStyles.find((item) => item.alias === column && item.link && item.linkUrl)
  if (!style) return ''
  return applyVariables(style.linkUrl, values, { __cell: String(row[column] ?? '') })
}

/** Resolve the link URL of a single stat value. */
export function statLink(panel: DynamicPanel, value: number, values: Record<string, string>): string {
  return applyVariables(panel.linkUrl, values, { __cell: String(value) })
}
