import { describe, expect, it } from 'vitest'
import { formatPodLogs, podLogQuery } from '@/utils/pod-log'
import type { PodLogDetails } from '@/api/resource'

const details: PodLogDetails = {
  info: { podName: 'shop-web-1', containerName: 'app' },
  selection: {
    referencePoint: { timestamp: '2026-01-01T00:00:00Z', lineNum: 0 },
    offsetFrom: -2,
    offsetTo: 0,
    logFilePosition: 'end',
  },
  logs: [
    { timestamp: '2026-01-01T00:00:00Z', content: 'first line' },
    { timestamp: '2026-01-01T00:00:01Z', content: 'second line' },
  ],
}

describe('pod log contract', () => {
  it('sends the containerName and backend offset fields rather than tailLines', () => {
    expect(podLogQuery('sidecar', 750, true)).toEqual({
      containerName: 'sidecar',
      offsetFrom: -750,
      offsetTo: 0,
      referenceTimestamp: 'newest',
      referenceLineNum: 0,
      logFilePosition: 'end',
      previous: true,
    })
  })

  it('clamps the requested window to the backend limit', () => {
    expect(podLogQuery('app', 9000).offsetFrom).toBe(-5000)
    expect(podLogQuery('app', 0).offsetFrom).toBe(-1)
  })

  it('renders the JSON log lines instead of treating the response as a string', () => {
    expect(formatPodLogs(details)).toBe('2026-01-01T00:00:00Z first line\n2026-01-01T00:00:01Z second line')
    expect(formatPodLogs(details, false)).toBe('first line\nsecond line')
    expect(formatPodLogs(undefined)).toBe('')
  })
})
