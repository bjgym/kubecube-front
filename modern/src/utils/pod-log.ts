import type { PodLogDetails, PodLogQuery } from '@/api/resource'

export function podLogQuery(containerName: string, limit = 500, previous = false): PodLogQuery {
  const window = Math.max(1, Math.min(5000, limit))
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

export function formatPodLogs(details: PodLogDetails | undefined, timestamps = true): string {
  if (!details?.logs?.length) return ''
  return details.logs.map((line) => (timestamps && line.timestamp ? `${line.timestamp} ${line.content}` : line.content)).join('\n')
}
