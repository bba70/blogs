import { useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { usePostStore, useTagStore } from '@/stores'
import PostCard from '@/components/PostCard'
import Pagination from '@/components/Pagination'
import LoadingSpinner from '@/components/LoadingSpinner'
import ErrorMessage from '@/components/ErrorMessage'
import TagBadge from '@/components/TagBadge'

export default function PostListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Number(searchParams.get('page')) || 1
  const activeTag = searchParams.get('tag') ?? undefined

  const { posts, pagination, loading, error, fetchPosts } = usePostStore()
  const { tags, fetchTags } = useTagStore()

  useEffect(() => {
    fetchTags()
  }, [fetchTags])

  useEffect(() => {
    fetchPosts({ page, per_page: 10, tag: activeTag })
  }, [page, activeTag, fetchPosts])

  function handlePageChange(p: number) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('page', String(p))
      return next
    })
  }

  if (loading && posts.length === 0) return <LoadingSpinner />
  if (error) return <ErrorMessage message={error} onRetry={() => fetchPosts({ page, per_page: 10, tag: activeTag })} />

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {tags.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setSearchParams({})}
            className={`rounded-full px-3 py-0.5 text-xs font-medium transition-colors ${
              !activeTag ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            全部
          </button>
          {tags.map((tag) => (
            <TagBadge key={tag.id} name={tag.name} active={activeTag === tag.name} />
          ))}
        </div>
      )}

      {posts.length === 0 ? (
        <div className="py-20 text-center text-gray-500">
          <p className="text-lg">暂无文章</p>
          <p className="mt-2 text-sm">点击右上角「写文章」开始创作</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}

      {pagination && (
        <Pagination
          page={pagination.page}
          perPage={pagination.per_page}
          total={pagination.total}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  )
}
