import { create } from 'zustand'
import type { Tag } from '@/types'
import { fetchTags } from '@/api'

interface TagState {
  tags: Tag[]
  loading: boolean
  error: string | null
  fetchTags: () => Promise<void>
}

export const useTagStore = create<TagState>()((set) => ({
  tags: [],
  loading: false,
  error: null,

  fetchTags: async () => {
    set({ loading: true, error: null })
    try {
      const res = await fetchTags()
      set({ tags: res.data, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },
}))
