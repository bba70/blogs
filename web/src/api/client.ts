import type { ApiResponse, PaginatedResponse } from '@/types'

const BASE_URL = '/api/v1'

async function request<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const json = await res.json()
  if (json.code !== 0) throw new Error(json.message || 'Request failed')
  return json
}

async function requestPaginated<T>(path: string, options?: RequestInit): Promise<PaginatedResponse<T>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const json = await res.json()
  if (json.code !== 0) throw new Error(json.message || 'Request failed')
  return json
}

export { request, requestPaginated }
