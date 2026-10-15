import type { Post, PostKind } from '@/types'
import { fetchPosts } from './posts'
import { fetchTags } from './tags'

// Only the author includes essay tags in the topic directory.
export async function fetchTopicTags(isOwner: boolean, signal: AbortSignal) {
  const responses = await Promise.all([
    fetchTags('article', signal),
    ...(isOwner ? [fetchTags('essay', signal)] : []),
  ])
  return [...new Map(responses.flatMap((response) => response.data).map((tag) => [tag.name, tag])).values()]
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
}

export async function fetchTopicPosts(tag: string, isOwner: boolean, signal: AbortSignal) {
  async function fetchKind(kind: PostKind) {
    const posts: Post[] = []
    for (let page = 1; ; page += 1) {
      const result = await fetchPosts({
        tag, kind, page, per_page: 100, status: isOwner ? 'all' : 'published',
      }, signal)
      posts.push(...result.data)
      if (result.data.length === 0 || page * result.meta.per_page >= result.meta.total) break
    }
    return [...new Map(posts.map((post) => [post.id, post])).values()]
      .sort((a, b) => Date.parse(b.published_at ?? b.created_at) - Date.parse(a.published_at ?? a.created_at) || b.id - a.id)
  }
  const [articles, essays] = await Promise.all([fetchKind('article'), isOwner ? fetchKind('essay') : Promise.resolve([])])
  return { articles, essays }
}
