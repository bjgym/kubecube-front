import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

export function formatDate(value?: string | number | Date, withSeconds = false): string {
  if (!value) return '—'
  const date = dayjs(value)
  if (!date.isValid()) return '—'
  return date.format(withSeconds ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD HH:mm')
}

export function fromNow(value?: string | number | Date): string {
  if (!value) return '—'
  const date = dayjs(value)
  return date.isValid() ? date.fromNow() : '—'
}

export function formatNumber(value?: number, maximumFractionDigits = 2): string {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return '—'
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits }).format(Number(value))
}

export function formatBytes(value?: number, unit: 'B' | 'Mi' | 'Gi' = 'Mi'): string {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return '—'
  const bytes = unit === 'Gi' ? Number(value) * 1024 ** 3 : unit === 'Mi' ? Number(value) * 1024 ** 2 : Number(value)
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const index = Math.min(Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024)), units.length - 1)
  return `${formatNumber(bytes / 1024 ** index)} ${units[index]}`
}

export function formatPercent(value?: number): string {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return '—'
  const percent = Math.abs(value) <= 1 ? value * 100 : value
  return `${formatNumber(percent, 1)}%`
}

export function getByPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => {
    if (value && typeof value === 'object') return (value as Record<string, unknown>)[key]
    return undefined
  }, source)
}

export function asText(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—'
  if (Array.isArray(value)) return value.join(', ') || '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
