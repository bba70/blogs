export type PostStatus = 'draft' | 'published'

export interface Post {
  id: number
  title: string
  slug: string
  content: string
  summary: string
  status: PostStatus
  created_at: string
  updated_at: string
  published_at: string | null
  tags: string[]
}

export interface PostListParams {
  page?: number
  per_page?: number
  tag?: string
  status?: PostStatus
}

export interface CreatePostPayload {
  title: string
  slug: string
  content: string
  summary?: string
  status?: PostStatus
  tags?: string[]
}

export interface UpdatePostPayload {
  title?: string
  slug?: string
  content?: string
  summary?: string
  status?: PostStatus
  tags?: string[]
}
