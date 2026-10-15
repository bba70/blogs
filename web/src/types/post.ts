export type PostStatus = 'draft' | 'published'
export type PostKind = 'article' | 'essay'

export interface Post {
  id: number
  title: string
  slug: string
  content: string
  summary: string
  cover_url: string
  status: PostStatus
  kind: PostKind
  created_at: string
  updated_at: string
  published_at: string | null
  tags: string[]
}

export interface PostListParams {
  page?: number
  per_page?: number
  tag?: string
  status?: PostStatus | 'all'
  kind?: PostKind
}

export interface CreatePostPayload {
  title: string
  slug: string
  content: string
  summary?: string
  cover_url?: string
  status?: PostStatus
  kind?: PostKind
  tags?: string[]
}

export interface UpdatePostPayload {
  title?: string
  slug?: string
  content?: string
  summary?: string
  cover_url?: string
  status?: PostStatus
  kind?: PostKind
  tags?: string[]
}
