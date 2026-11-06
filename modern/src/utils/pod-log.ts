import type { PodLogDetails, PodLogLine, PodLogQuery, PodLogSelection } from '@/api/resource'

const MAX_LOG_WINDOW = 5000

function windowSize(limit: number): number {
  const numeric = Number(limit)
  const value = Number.isFinite(numeric) ? Math.trunc(numeric) : 500
  return Math.max(1, Math.min(MAX_LOG_WINDOW, value))
}

export function podLogQuery(containerName: string, limit = 500, previous = false): PodLogQuery {
  const window = windowSize(limit)
  return {
    containerName,
    offsetFrom: -window,
    offsetTo: 0,
    referenceTimestamp: 'newest',
    referenceLineNum: 0,
    logFilePosition: 'end',
    previous,
  }
}

export function olderPodLogQuery(containerName: string, selection: PodLogSelection, limit = 500, previous = false): PodLogQuery {
  const window = windowSize(limit)
  return {
    containerName,
    offsetFrom: selection.offsetFrom - window,
    offsetTo: selection.offsetTo,
    referenceTimestamp: selection.referencePoint.timestamp,
    referenceLineNum: selection.referencePoint.lineNum,
    logFilePosition: selection.logFilePosition,
    previous,
  }
}

function lineKey(line: PodLogLine): string {
  return `${line.timestamp}\u0000${line.content}`
}

export function mergeOlderLogs(current: PodLogLine[], older: PodLogLine[]): PodLogLine[] {
  const seen = new Set<string>()
  const merged: PodLogLine[] = []
  for (const line of [...older, ...current]) {
    const key = lineKey(line)
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(line)
  }
  return merged
}

export function formatPodLogs(details: PodLogDetails | undefined, timestamps = true): string {
  if (!details?.logs?.length) return ''
  return details.logs.map((line) => (timestamps && line.timestamp ? `${line.timestamp} ${line.content}` : line.content)).join('\n')
}
