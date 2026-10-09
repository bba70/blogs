import type { ApiResponse, PaginatedResponse } from '@/types'

const BASE_URL = '/api/v1'

export class ApiError extends Error {
  status: number
  code: number

  constructor(message: string, status: number, code: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

async function fetchJSON(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      ...(options?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...options?.headers,
    },
  })

  if (res.status === 204) {
    return { res, json: { code: 0, message: 'success', data: undefined } }
  }

  let json: { code?: number; message?: string; data?: unknown; meta?: unknown }
  try {
    json = await res.json()
  } catch {
    throw new ApiError(res.ok ? '响应格式无效' : `请求失败（${res.status}）`, res.status, -1)
  }

  if (!res.ok || json.code !== 0) {
    throw new ApiError(json.message || '请求失败', res.status, json.code ?? -1)
  }
  return { res, json }
}

async function request<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const { json } = await fetchJSON(path, options)
  return json as ApiResponse<T>
}

async function requestPaginated<T>(path: string, options?: RequestInit): Promise<PaginatedResponse<T>> {
  const { json } = await fetchJSON(path, options)
  return json as PaginatedResponse<T>
}

export { request, requestPaginated }
