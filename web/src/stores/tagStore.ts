import { create } from 'zustand'
import type { Tag } from '@/types'
import * as api from '@/api'
import { useAuthStore } from './authStore'

interface TagState {
  tags: Tag[]
  loading: boolean
  error: string | null
  fetchTags: () => Promise<void>
  reset: () => void
}

// 列表筛选的只读聚合；编辑器的标签保存在各自文章表单中。
export const useTagStore = create<TagState>()((set) => {
  let revision = 0
  const empty = { tags: [], loading: false, error: null }
  return {
    ...empty,
    fetchTags: async () => {
      const request = ++revision
      set({ loading: true, error: null })
      try {
        const res = await api.fetchTags()
        if (request === revision) set({ tags: res.data, loading: false })
      } catch {
        if (request === revision) set({ error: '标签暂时无法加载，请稍后重试。', loading: false })
      }
    },
    reset: () => { revision += 1; set(empty) },
  }
})

useAuthStore.subscribe((state, previous) => {
  if (previous.authenticated && !state.authenticated) useTagStore.getState().reset()
})
