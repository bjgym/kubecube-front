import axios, { AxiosError, type AxiosRequestConfig, type AxiosResponse } from 'axios'
import { ElMessage } from 'element-plus'
import { mockAdapter } from './mock/adapter'
import { storage } from '@/utils/storage'
import { isAuthLocation, locationFromHash } from '@/utils/last-location'

export interface ApiRequestConfig<D = unknown> extends AxiosRequestConfig<D> {
  silent?: boolean
  noAlert?: boolean
}

export class ApiError<T = unknown> extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly data?: T,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export const http = axios.create({
  timeout: 30_000,
  adapter: import.meta.env.VITE_USE_MOCK === 'true' ? mockAdapter : undefined,
})

function errorMessage(error: AxiosError): string {
  const data = error.response?.data as { message?: string } | string | undefined
  if (typeof data === 'string' && data) return data
  if (data && typeof data === 'object' && data.message) return data.message
  if (error.code === 'ECONNABORTED') return '请求超时，请检查网络后重试'
  if (!error.response) return '无法连接服务，请检查网络或后端服务状态'
  return error.message || '请求失败，请稍后重试'
}

http.interceptors.response.use(undefined, (error: AxiosError) => {
  const config = error.config as ApiRequestConfig | undefined
  const status = error.response?.status ?? 0
  const data = error.response?.data

  if (!config?.noAlert) {
    if (status === 401) {
      const current = locationFromHash(window.location.hash)
      if (!isAuthLocation(current)) {
        storage.remove('user')
        storage.setJSON('lastlocation', current)
        window.dispatchEvent(new CustomEvent('kubecube:unauthorized', { detail: current }))
      }
    } else if (!config?.silent) {
      const message = status === 403 ? '您没有执行此操作的权限，请联系管理员' : errorMessage(error)
      ElMessage.error(message)
    }
  }

  throw new ApiError(errorMessage(error), status, data)
})

export async function request<T>(config: ApiRequestConfig): Promise<T> {
  const { silent: _silent, noAlert: _noAlert, ...axiosConfig } = config
  const response = await http.request<T>({ ...axiosConfig, silent: config.silent, noAlert: config.noAlert } as AxiosRequestConfig)
  return response.data
}

export async function requestResponse<T>(config: ApiRequestConfig): Promise<AxiosResponse<T>> {
  const { silent: _silent, noAlert: _noAlert, ...axiosConfig } = config
  return http.request<T>({ ...axiosConfig, silent: config.silent, noAlert: config.noAlert } as AxiosRequestConfig)
}
