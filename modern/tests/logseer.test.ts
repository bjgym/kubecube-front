import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ request: vi.fn().mockResolvedValue({ hits: { hits: [], total: 0 } }) }))

vi.mock('@/api/http', () => ({ request: mocks.request }))

import { logseerApi } from '@/api/logseer'

describe('Logseer request contract', () => {
  it('sends desensitize as a query parameter and keeps the search body untouched', async () => {
    const body = { query: { bool: { filter: [] } }, from: 0, size: 50 }
    await logseerApi.search(body)
    expect(mocks.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/v1/logseer/extends/elasticsearch/_search',
        method: 'POST',
        data: body,
        params: { desensitize: false },
      }),
    )
  })
})
