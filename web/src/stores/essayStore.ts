import { create } from 'zustand'
import { fetchPosts, fetchTags, isApiError } from '@/api'
import type { PaginationMeta, Post, Tag } from '@/types'
import { useAuthStore } from './authStore'

interface EssayState {
  posts: Post[]
  tags: Tag[]
  pagination: PaginationMeta | null
  loading: boolean
  error: string | null
  tagsError: string | null
  fetchEssays: (page: number, tag?: string) => Promise<void>
  fetchEssayTags: () => Promise<void>
  reset: () => void
}

// Keep essays separate from the article list and ignore superseded requests.
export const useEssayStore = create<EssayState>()((set) => {
  let listRequest = 0
  let tagRequest = 0
  const empty = { posts: [], tags: [], pagination: null, loading: true, error: null, tagsError: null }
  return {
    ...empty,
    fetchEssays: async (page, tag) => {
      const request = ++listRequest
      set({ loading: true, error: null })
      try {
        const status = useAuthStore.getState().authenticated ? 'all' : 'published'
        const result = await fetchPosts({ page, per_page: 10, kind: 'essay', status, tag })
        if (request === listRequest) set({ posts: result.data, pagination: result.meta, loading: false })
      } catch (error) {
        if (request !== listRequest) return
        if (isApiError(error) && error.status === 401 && useAuthStore.getState().authenticated) useAuthStore.getState().expireSession()
        else set({ error: '随笔暂时无法加载，请稍后重试。', loading: false })
      }
    },
    fetchEssayTags: async () => {
      const request = ++tagRequest
      set({ tagsError: null })
      try {
        const result = await fetchTags('essay')
        if (request === tagRequest) set({ tags: result.data })
      } catch (error) {
        if (request !== tagRequest) return
        if (isApiError(error) && error.status === 401 && useAuthStore.getState().authenticated) useAuthStore.getState().expireSession()
        else set({ tagsError: '标签暂时无法加载。' })
      }
    },
    reset: () => {
      listRequest += 1
      tagRequest += 1
      set(empty)
    },
  }
})

useAuthStore.subscribe((state, previous) => {
  if (previous.authenticated !== state.authenticated) useEssayStore.getState().reset()
})
