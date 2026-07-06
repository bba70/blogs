import type { Tag } from '@/types'
import { request } from './client'

export async function fetchTags() {
  return request<Tag[]>('/tags')
}
