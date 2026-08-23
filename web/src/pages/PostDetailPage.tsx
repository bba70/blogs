import { useEffect } from 'react'
import { useParams, Link } from 'react-router'
import { usePostStore } from '@/stores'
import LoadingSpinner from '@/components/LoadingSpinner'
import ErrorMessage from '@/components/ErrorMessage'
import StatusBadge from '@/components/StatusBadge'
import TagBadge from '@/components/TagBadge'
import MarkdownRenderer from '@/modules/editor/MarkdownRenderer'

function readingMinutes(content: string) {
  return Math.max(1, Math.ceil(content.replace(/\s/g, '').length / 500))
}

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
    <div className="mx-auto max-w-[1180px] px-5 py-10 sm:px-8 sm:py-16">
      <Link to="/#articles" className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-primary">
        <span aria-hidden="true">←</span> 返回文章列表
      </Link>

      <article className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,760px)_240px] lg:justify-between">
        <div>
          <header className="border-b border-line pb-9">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={currentPost.status} />
              {currentPost.tags.map((tag) => <TagBadge key={tag} name={tag} />)}
            </div>
            <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-[-0.04em] text-ink sm:text-5xl">
              {currentPost.title}
            </h1>
            {currentPost.summary && <p className="mt-5 text-lg leading-8 text-muted">{currentPost.summary}</p>}
            <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-muted">
              <time>{new Date(currentPost.published_at ?? currentPost.created_at).toLocaleDateString('zh-CN')}</time>
              <span>·</span>
              <span>{readingMinutes(currentPost.content)} 分钟阅读</span>
            </div>
          </header>

          <div className="py-10">
            <MarkdownRenderer content={currentPost.content} />
          </div>

          <div className="flex items-center justify-between border-t border-line pt-7">
            <p className="text-sm text-muted">最后更新于 {new Date(currentPost.updated_at).toLocaleDateString('zh-CN')}</p>
            <Link to={`/editor/${currentPost.slug}`} className="rounded-[10px] border border-line px-4 py-2 text-sm text-ink hover:border-primary hover:text-primary">
              编辑文章
            </Link>
          </div>
        </div>

        <aside className="hidden border-l border-line pl-7 text-sm text-muted lg:block">
          <p className="font-medium text-ink">文章目录</p>
          <p className="mt-4 leading-7">沉浸阅读模式下，标题结构会在后续迭代中自动生成目录。</p>
        </aside>
      </article>
    </div>
  )
}
