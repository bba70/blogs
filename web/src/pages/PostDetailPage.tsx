import { useEffect } from 'react'
import { useParams, Link } from 'react-router'
import { usePostStore } from '@/stores'
import LoadingSpinner from '@/components/LoadingSpinner'
import ErrorMessage from '@/components/ErrorMessage'
import StatusBadge from '@/components/StatusBadge'
import TagBadge from '@/components/TagBadge'
import MarkdownRenderer from '@/modules/editor/MarkdownRenderer'

export default function PostDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const { currentPost, loading, error, fetchPost } = usePostStore()

  useEffect(() => {
    if (slug) fetchPost(slug)
  }, [slug, fetchPost])

  if (loading) return <LoadingSpinner />
  if (error) return <ErrorMessage message={error} onRetry={() => slug && fetchPost(slug)} />
  if (!currentPost) return <ErrorMessage message="文章不存在" />

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <article>
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{currentPost.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-500">
            <StatusBadge status={currentPost.status} />
            <time>{new Date(currentPost.created_at).toLocaleDateString('zh-CN')}</time>
            {currentPost.tags.map((tag) => <TagBadge key={tag} name={tag} />)}
          </div>
        </header>

        <MarkdownRenderer content={currentPost.content} />

        <div className="mt-8 border-t border-gray-200 pt-6">
          <Link
            to={`/editor/${currentPost.slug}`}
            className="text-sm text-primary hover:text-primary-dark"
          >
            编辑文章
          </Link>
        </div>
      </article>
    </div>
  )
}
