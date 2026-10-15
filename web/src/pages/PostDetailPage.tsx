import { useEffect, useLayoutEffect, useRef } from 'react'
import { useParams, Link } from 'react-router'
import { useAuthStore, usePostStore } from '@/stores'
import AuthorAvatar from '@/components/AuthorAvatar'
import LoadingSpinner from '@/components/LoadingSpinner'
import ErrorMessage from '@/components/ErrorMessage'
import MarkdownRenderer from '@/modules/editor/MarkdownRenderer'
import ReadingProgress from '@/components/ReadingProgress'
import PostCover from '@/components/PostCover'
import './PostDetailPage.css'

function readingMinutes(content: string) {
  return Math.max(1, Math.ceil(content.replace(/\s/g, '').length / 500))
}

function characterCount(content: string) {
  const count = content.replace(/\s/g, '').length
  return count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count)
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export default function PostDetailPage() {
  const contentRef = useRef<HTMLDivElement>(null)
  const { slug } = useParams<{ slug: string }>()
  const { currentPost, loading, error, fetchPost } = usePostStore()
  const authenticated = useAuthStore((state) => state.authenticated)

  useLayoutEffect(() => {
    // Route navigation keeps the list's scroll offset; start each article at its header.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [slug])

  useEffect(() => {
    if (slug) fetchPost(slug)
  }, [slug, fetchPost, authenticated])

  if (loading) return <div className="post-detail-state"><LoadingSpinner /></div>
  if (error) return <div className="post-detail-state"><ErrorMessage message={error} onRetry={() => slug && fetchPost(slug)} /></div>
  if (!currentPost || currentPost.slug !== slug) return <div className="post-detail-state"><LoadingSpinner /></div>
  if (!authenticated && (currentPost.status === 'draft' || currentPost.kind === 'essay')) {
    return <div className="post-detail-state"><LoadingSpinner /></div>
  }

  const publishedDate = currentPost.status === 'draft' ? currentPost.created_at : currentPost.published_at ?? currentPost.created_at
  const isEssay = currentPost.kind === 'essay'
  const contentLabel = isEssay ? '随笔' : '文章'
  const listPath = isEssay ? '/essays' : '/blog'

  return (
    <article className={`post-detail-page${isEssay ? ' post-detail-page--essay' : ''}`}>
      <ReadingProgress key={currentPost.slug} contentRef={contentRef} />
      <header className="post-detail-hero">
        <PostCover src={currentPost.cover_url} className="post-detail-cover" />
        <div className="post-detail-hero__art" aria-hidden="true">
          <span className="post-detail-hero__glyph">{currentPost.title.slice(0, 1)}</span>
          <span className="post-detail-hero__orbit" />
          <span className="post-detail-hero__dots" />
        </div>
        <div className="post-detail-hero__shade" aria-hidden="true" />

        <div className="post-detail-shell post-detail-hero__inner">
          <div className="post-detail-hero__actions">
            <Link to={listPath} className="post-detail-back">
              <span aria-hidden="true">←</span> 全部{contentLabel}
            </Link>
            {authenticated && (
              <Link
                to={`/editor/${encodeURIComponent(currentPost.slug)}`}
                className="post-detail-back post-detail-edit"
                aria-label={`继续编辑${contentLabel}`}
              >
                继续编辑
              </Link>
            )}
          </div>

          <div className="post-detail-hero__content">
            <div className="post-detail-hero__tags">
              {currentPost.status === 'draft' && <span className="post-detail-hero__draft">草稿</span>}
              {currentPost.kind === 'essay' && (
                <span className="post-detail-hero__draft">随笔</span>
              )}
              {currentPost.tags.slice(0, 4).map((tag) => (
                <Link key={tag} to={`/topics?tag=${encodeURIComponent(tag)}`}>#{tag}</Link>
              ))}
            </div>
            <h1>{currentPost.title}</h1>
            {currentPost.summary && <p className="post-detail-hero__summary">{currentPost.summary}</p>}
            <div className="post-detail-hero__meta">
              <time dateTime={publishedDate}>{currentPost.status === 'draft' ? '创建于' : '发布于'} {formatDate(publishedDate)}</time>
              <span aria-hidden="true">·</span>
              <span>约 {characterCount(currentPost.content)} 字</span>
              <span aria-hidden="true">·</span>
              <span>{readingMinutes(currentPost.content)} 分钟阅读</span>
            </div>
          </div>
        </div>
      </header>

      <div className="post-detail-shell post-detail-layout">
        <main className="post-detail-content-card">
          {!isEssay && currentPost.summary && (
            <aside className="post-detail-lead" aria-label="文章摘要">
              <span>摘要</span>
              <p>{currentPost.summary}</p>
            </aside>
          )}

          <div ref={contentRef} className="post-detail-markdown">
            <MarkdownRenderer content={currentPost.content} />
          </div>

          <footer className="post-detail-footer">
            <div>
              <span>最后更新</span>
              <time dateTime={currentPost.updated_at}>{formatDate(currentPost.updated_at)}</time>
            </div>
            {authenticated && <Link to={`/editor/${encodeURIComponent(currentPost.slug)}`}>编辑{contentLabel}</Link>}
          </footer>
        </main>

        {!isEssay && <aside className="post-detail-sidebar" aria-label="文章侧栏">
          <section className="post-detail-side-card post-detail-author">
            <AuthorAvatar className="post-detail-author__avatar" editable={false} />
            <h2>bba70</h2>
            <p>独立开发者 / 写作者</p>
            <p className="post-detail-author__bio">在代码、产品与日常之间，记录值得长期保留的想法。</p>
            <Link to="/#about">关于作者</Link>
          </section>

          <section className="post-detail-side-card post-detail-info">
            <h2>本文信息</h2>
            <dl>
              <div><dt>发布</dt><dd>{formatDate(publishedDate)}</dd></div>
              <div><dt>更新</dt><dd>{formatDate(currentPost.updated_at)}</dd></div>
              <div><dt>篇幅</dt><dd>约 {characterCount(currentPost.content)} 字</dd></div>
            </dl>
            {currentPost.tags.length > 0 && (
              <div className="post-detail-info__tags">
                {currentPost.tags.map((tag) => (
                  <Link key={tag} to={`/topics?tag=${encodeURIComponent(tag)}`}>#{tag}</Link>
                ))}
              </div>
            )}
          </section>

          <section className="post-detail-side-card post-detail-note">
            <h2><span aria-hidden="true">✦</span> 阅读提示</h2>
            <p>专注于内容本身。如果这篇文章带来一点启发，欢迎继续浏览同主题的记录。</p>
            <Link to="/blog">返回全部文章 <span aria-hidden="true">→</span></Link>
          </section>
        </aside>}
      </div>
    </article>
  )
}
