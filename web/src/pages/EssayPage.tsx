import { useCallback, useEffect, useId, useState } from 'react'
import { Calendar, CaretDown, CaretUp, Clock, Hash, Notebook, PenNib, Sparkle } from '@/components/blogIcons'
import { Link, useSearchParams } from 'react-router'
import { useEssayStore } from '@/stores/essayStore'
import { useAuthStore } from '@/stores'
import ErrorMessage from '@/components/ErrorMessage'
import LoadingSpinner from '@/components/LoadingSpinner'
import Pagination from '@/components/Pagination'
import PostCover from '@/components/PostCover'
import BrowseSidebar from '@/components/BrowseSidebar'
import MarkdownRenderer from '@/modules/editor/MarkdownRenderer'
import type { Post } from '@/types'
import './EssayPage.css'

const essayDate = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
})

function EssayListItem({ post }: { post: Post }) {
  const [expanded, setExpanded] = useState(false)
  const masonryRef = useCallback((node: HTMLElement | null) => {
    if (!node) return
    // Fixed 1px grid tracks let each card reserve only its own height plus the gap.
    const updateSpan = () => {
      const gap = node.parentElement ? parseFloat(getComputedStyle(node.parentElement).columnGap) || 0 : 0
      node.style.setProperty('--essay-row-span', String(Math.ceil(node.getBoundingClientRect().height + gap)))
    }
    updateSpan()
    const observer = new ResizeObserver(updateSpan)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  const contentId = useId()
  const date = post.status === 'draft' ? post.created_at : post.published_at ?? post.created_at
  const minutes = Math.max(1, Math.ceil(post.content.replace(/\s/g, '').length / 500))

  return (
    <article ref={masonryRef} className="essay-list-item">
      <div className="essay-list-item__content">
        <h2 className="essay-list-item__title">
          <Link to={`/posts/${encodeURIComponent(post.slug)}`}>{post.title}</Link>
          {post.status === 'draft' && <span className="essay-badge essay-badge--draft">草稿</span>}
        </h2>
        {!expanded && post.summary && <p className="essay-list-item__summary">{post.summary}</p>}
        <PostCover src={post.cover_url} className="essay-list-item__cover" />
        <div id={contentId} hidden={!expanded} className="essay-expanded-content">
          {expanded && <MarkdownRenderer content={post.content} />}
        </div>
        <div className="essay-list-item__meta">
          <time dateTime={date}><Calendar size={14} aria-hidden="true" />{essayDate.format(new Date(date))}{post.status === 'draft' ? ' · 创建' : ''}</time>
          <span className="essay-list-item__minutes"><Clock size={14} aria-hidden="true" />{minutes} 分钟阅读</span>
          <div className="essay-list-item__tags">{post.tags.slice(0, 3).map((tag) => (
            <Link key={tag} to={`/topics?tag=${encodeURIComponent(tag)}`} className="essay-list-item__tag"><Hash size={12} aria-hidden="true" />{tag}</Link>
          ))}</div>
          <button type="button" className="essay-expand" aria-expanded={expanded} aria-controls={contentId} onClick={() => setExpanded(!expanded)}>
            {expanded ? '收起记录' : '展开记录'}{expanded ? <CaretUp size={14} aria-hidden="true" /> : <CaretDown size={14} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </article>
  )
}

export default function EssayPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedPage = Number(searchParams.get('page'))
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const activeTag = searchParams.get('tag') || undefined
  const authenticated = useAuthStore((state) => state.authenticated)
  const initialized = useAuthStore((state) => state.initialized)
  const { posts, pagination, loading, error, fetchEssays } = useEssayStore()

  useEffect(() => { if (initialized) void fetchEssays(page, activeTag) }, [activeTag, fetchEssays, page, initialized, authenticated])

  function selectTag(tag?: string) {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      next.delete('page')
      if (tag) next.set('tag', tag)
      else next.delete('tag')
      return next
    })
  }

  function handlePageChange(nextPage: number) {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      next.set('page', String(nextPage))
      return next
    })
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }

  return (
    <div className="essay-page">
      <header className="essay-hero">
        <div className="essay-shell">
          <div className="essay-hero__row">
            <div><h1><span className="page-title-icon page-title-icon--green"><Notebook size={36} weight="duotone" aria-hidden="true" /></span>随笔</h1><p>不必成篇，记下此刻的想法。</p></div>
            {authenticated && <Link to="/editor?kind=essay" className="essay-write"><PenNib size={16} aria-hidden="true" />写随笔</Link>}
          </div>
        </div>
      </header>

      <div className="essay-shell essay-layout">
        <main className="essay-main">
          <div className="essay-reading">
          <div className="essay-reading__heading">
            <h2><Sparkle size={21} weight="duotone" aria-hidden="true" />{activeTag ? `${activeTag}下的记录` : '最近的记录'}</h2>
            <span className="essay-count">{loading ? '加载中…' : error ? '暂时无法获取篇数' : `${pagination?.total ?? 0} 篇随笔`}</span>
          </div>

          <section className={`essay-list${!loading && !error && posts.length > 0 ? ' essay-list--masonry' : ''}`} aria-label="随笔列表" aria-live="polite" aria-busy={loading}>
            {loading ? (
              <div className="essay-loading"><LoadingSpinner /><span>正在加载随笔…</span></div>
            ) : error ? (
              <div className="essay-state" role="alert"><ErrorMessage message={error} onRetry={() => void fetchEssays(page, activeTag)} /></div>
            ) : posts.length > 0 ? (
              posts.map((post) => <EssayListItem key={post.id} post={post} />)
            ) : (
              <div className="essay-state essay-empty">
                <Notebook size={40} weight="duotone" className="essay-empty__icon" aria-hidden="true" />
                <h2>{activeTag ? '这个标签下还没有记录' : page > 1 ? '这一页没有随笔' : '还没有随笔'}</h2>
                <p>{activeTag ? '换一个标签，或查看全部随笔。' : page > 1 ? '回到第一页，继续翻阅已有的记录。' : authenticated ? '把此刻的想法记下来，留给以后的自己。' : '新的记录会在发布后出现在这里。'}</p>
                {activeTag ? <button type="button" className="essay-write" onClick={() => selectTag()}>查看全部随笔</button>
                  : page > 1 ? <button type="button" className="essay-write" onClick={() => handlePageChange(1)}>返回第一页</button>
                  : authenticated ? <Link to="/editor?kind=essay" className="essay-write">写第一篇随笔</Link> : null}
              </div>
            )}
          </section>
          {!error && pagination && posts.length > 0 && (
            <Pagination label="随笔分页" disabled={loading} page={pagination.page} perPage={pagination.per_page} total={pagination.total} onPageChange={handlePageChange} />
          )}
          {!loading && !error && posts.length > 0 && pagination && pagination.page * pagination.per_page >= pagination.total && (
            <p className="essay-end">已经看到全部记录</p>
          )}
          </div>
        </main>
      <BrowseSidebar pageCount={posts.length} />
      </div>
    </div>
  )
}
