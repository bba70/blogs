import type { Post, PostListParams, CreatePostPayload, UpdatePostPayload } from '@/types'
import { request, requestPaginated } from './client'

function buildQuery(params?: PostListParams): string {
  if (!params) return ''
  const sp = new URLSearchParams()
  if (params.page) sp.set('page', String(params.page))
  if (params.per_page) sp.set('per_page', String(params.per_page))
  if (params.tag) sp.set('tag', params.tag)
  if (params.status) sp.set('status', params.status)
  const q = sp.toString()
  return q ? `?${q}` : ''
}

export async function fetchPosts(params?: PostListParams) {
  return requestPaginated<Post>(`/posts${buildQuery(params)}`)
}

export async function fetchPost(slug: string) {
  return request<Post>(`/posts/${encodeURIComponent(slug)}`)
}

export async function createPost(payload: CreatePostPayload) {
  return request<Post>('/posts', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updatePost(slug: string, payload: UpdatePostPayload) {
  return request<Post>(`/posts/${encodeURIComponent(slug)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function deletePost(slug: string) {
  return request<void>(`/posts/${encodeURIComponent(slug)}`, {
    method: 'DELETE',
  })
}
