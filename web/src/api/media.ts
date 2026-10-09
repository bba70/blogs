import { request } from './client'

export async function uploadImage(file: File, signal?: AbortSignal) {
  const body = new FormData()
  body.append('file', file)
  return request<{ url: string }>('/media', { method: 'POST', body, signal })
}
