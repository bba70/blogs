import type { PostKind, Tag } from '@/types'
import { request } from './client'

export async function fetchTags(kind?: PostKind, signal?: AbortSignal) {
  return request<Tag[]>(kind ? `/tags?kind=${kind}` : '/tags', { signal })
}
