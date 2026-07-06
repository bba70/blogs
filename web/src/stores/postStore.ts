import { create } from 'zustand'
import type { Post, PostListParams, CreatePostPayload, UpdatePostPayload, PaginationMeta } from '@/types'
import * as api from '@/api'

interface PostState {
  posts: Post[]
  currentPost: Post | null
  pagination: PaginationMeta | null
  loading: boolean
  error: string | null
  fetchPosts: (params?: PostListParams) => Promise<void>
  fetchPost: (slug: string) => Promise<void>
  createPost: (payload: CreatePostPayload) => Promise<string | null>
  updatePost: (slug: string, payload: UpdatePostPayload) => Promise<boolean>
  deletePost: (slug: string) => Promise<boolean>
}

export const usePostStore = create<PostState>()((set) => ({
  posts: [],
  currentPost: null,
  pagination: null,
  loading: false,
  error: null,

  fetchPosts: async (params) => {
    set({ loading: true, error: null })
    try {
      const res = await api.fetchPosts(params)
      set({ posts: res.data, pagination: res.meta, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  fetchPost: async (slug) => {
    set({ loading: true, error: null })
    try {
      const res = await api.fetchPost(slug)
      set({ currentPost: res.data, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  createPost: async (payload) => {
    set({ loading: true, error: null })
    try {
      const res = await api.createPost(payload)
      set({ loading: false })
      return res.data.slug
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      return null
    }
  },

  updatePost: async (slug, payload) => {
    set({ loading: true, error: null })
    try {
      await api.updatePost(slug, payload)
      set({ loading: false })
      return true
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      return false
    }
  },

  deletePost: async (slug) => {
    set({ loading: true, error: null })
    try {
      await api.deletePost(slug)
      set((s) => ({ posts: s.posts.filter((p) => p.slug !== slug), loading: false }))
      return true
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      return false
    }
  },
}))
