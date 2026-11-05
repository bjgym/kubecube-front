import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { http, request } from '@/api/http'

const originalAdapter = http.defaults.adapter

function unauthorizedAdapter(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
  const response = {
    data: { message: '登录已过期' },
    status: 401,
    statusText: 'Unauthorized',
    headers: {},
    config,
  } as AxiosResponse
  return Promise.reject(new AxiosError('登录已过期', 'ERR_BAD_REQUEST', config, undefined, response))
}

describe('401 handling', () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.replaceState(null, '', '/public/')
    http.defaults.adapter = unauthorizedAdapter
  })

  afterEach(() => {
    http.defaults.adapter = originalAdapter
    window.history.replaceState(null, '', '/public/')
    localStorage.clear()
  })

  it('stores the current hash path and query separately before redirecting', async () => {
    window.history.replaceState(null, '', '/public/#/control/deployments/shop-web/info?tenant=retail&cluster=prod&namespace=shop')
    await expect(request({ url: '/api/v1/cube/user' })).rejects.toMatchObject({ status: 401 })
    expect(JSON.parse(localStorage.getItem('lastlocation') || '{}')).toEqual({
      path: '/control/deployments/shop-web/info',
      query: { tenant: 'retail', cluster: 'prod', namespace: 'shop' },
    })
  })

  it('does not overwrite the previous destination from a failed login request', async () => {
    window.history.replaceState(null, '', '/public/#/login')
    await expect(request({ url: '/api/v1/cube/login', method: 'POST' })).rejects.toMatchObject({ status: 401 })
    expect(localStorage.getItem('lastlocation')).toBeNull()
  })
})
