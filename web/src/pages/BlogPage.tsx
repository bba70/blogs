import { useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ArrowUpRight, BookOpen, Books, Calendar, Clock, Code, Hash, MagnifyingGlass, PenNib, Sparkle, X } from '@/components/blogIcons'
import ErrorMessage from '@/components/ErrorMessage'
import LoadingSpinner from '@/components/LoadingSpinner'
import Pagination from '@/components/Pagination'
import PostCover from '@/components/PostCover'
import BrowseSidebar from '@/components/BrowseSidebar'
import { usePostStore } from '@/stores'
import type { Post } from '@/types'
import useArticleReveal from '@/hooks/useArticleReveal'
import './BlogPage.css'

const PAGE_SIZE = 8

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function readingMinutes(content: string) {
  return Math.max(1, Math.ceil(content.replace(/\s/g, '').length / 500))
}

function BlogListItem({ post, featured, index }: { post: Post; featured?: boolean; index: number }) {
  const revealRef = useArticleReveal(index * 45)
  const artStyle = ['code', 'book', 'pen'][Math.abs(post.id) % 3]
  const CoverIcon = artStyle === 'code' ? Code : artStyle === 'book' ? BookOpen : PenNib

  return (
    <article ref={revealRef} className={`blog-list-item${featured ? ' blog-list-item--featured' : ''}`}>
      <div className="blog-list-item__content">
        <div className="blog-list-item__eyebrow">
          {featured && <span className="blog-list-item__latest"><Sparkle size={12} weight="fill" aria-hidden="true" />最新</span>}
          <span>{post.tags[0] ?? '未分类'}</span>
        </div>
        <Link to={`/posts/${post.slug}`} className="blog-list-item__title-link">
          <h2>{post.title}</h2><ArrowUpRight className="blog-list-item__arrow" size={22} aria-hidden="true" />
        </Link>
        <p className="blog-list-item__summary">
          {post.summary || '这篇文章暂时没有摘要，点击标题继续阅读全文。'}
        </p>
        <div className="blog-list-item__meta">
          <time dateTime={post.published_at ?? post.created_at}>
            <Calendar size={14} aria-hidden="true" />
            {formatDate(post.published_at ?? post.created_at)}
          </time>
          <span><Clock size={14} aria-hidden="true" />{readingMinutes(post.content)} 分钟阅读</span>
          {post.tags.slice(0, 3).map((tag) => (
            <Link key={tag} to={`/topics?tag=${encodeURIComponent(tag)}`} className="blog-list-item__tag">
              <Hash size={12} aria-hidden="true" />{tag}
            </Link>
          ))}
        </div>
      </div>

      <PostCover src={post.cover_url} className="blog-post-art blog-post-cover" fallback={<div className={`blog-post-art blog-post-art--${artStyle}`} aria-hidden="true">
        <CoverIcon size={64} weight="duotone" />
      </div>} />
    </article>
  )
}

export default function BlogPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedPage = Number(searchParams.get('page'))
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const activeTag = searchParams.get('tag') ?? undefined
  const query = searchParams.get('q')?.trim().toLocaleLowerCase('zh-CN') ?? ''
  const perPage = query ? 100 : PAGE_SIZE

  const { posts, pagination, loading, error, fetchPosts } = usePostStore()
  useEffect(() => {
    fetchPosts({ page: query ? 1 : page, per_page: perPage, tag: activeTag, status: 'published', kind: 'article' })
  }, [activeTag, fetchPosts, page, perPage, query])

  const visiblePosts = useMemo(() => {
    if (!query) return posts
    return posts.filter((post) =>
      [post.title, post.summary, ...post.tags].some((value) => value.toLocaleLowerCase('zh-CN').includes(query)),
    )
  }, [posts, query])

  function handlePageChange(nextPage: number) {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      next.set('page', String(nextPage))
      return next
    })
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }

  function clearFilters() {
    setSearchParams({})
  }

  return (
    <div className="blog-index-page">
      <header className="blog-index-hero">
        <div className="blog-index-shell">
          <div className="blog-index-hero__title-row">
            <div>
              <h1><span className="blog-heading-icon" aria-hidden="true"><Books size={36} weight="duotone" /></span>全部文章</h1>
              <p>关于代码、产品与生活的长期记录。</p>
            </div>
            <p className="blog-index-hero__count">
              <strong>{pagination?.total ?? 0}</strong>
              <span>篇文章</span>
            </p>
          </div>
        </div>
      </header>

      <div className="blog-index-shell blog-index-layout">
        <main className="blog-index-main">
          {(activeTag || query) && (
            <section className="blog-index-filters" aria-label="文章筛选">
              <button type="button" onClick={clearFilters} className="blog-index-filters__clear">
                <X size={15} aria-hidden="true" />清除筛选
              </button>
            </section>
          )}

          {query && (
            <p className="blog-index-result-note">
              “{searchParams.get('q')}” 的搜索结果 · {visiblePosts.length} 篇
            </p>
          )}

          <section className="blog-list" aria-label="文章列表" aria-live="polite" aria-busy={loading}>
            {loading && posts.length === 0 ? (
              <div role="status" aria-label="正在加载文章"><LoadingSpinner /></div>
            ) : error ? (
              <ErrorMessage
                message={error}
                onRetry={() => fetchPosts({ page: query ? 1 : page, per_page: perPage, tag: activeTag, status: 'published', kind: 'article' })}
              />
            ) : visiblePosts.length > 0 ? (
              visiblePosts.map((post, index) => <BlogListItem key={post.id} post={post} index={index} featured={page === 1 && index === 0} />)
            ) : (
              <div className="blog-index-empty">
                <span className="blog-empty-icon"><MagnifyingGlass size={40} weight="duotone" aria-hidden="true" /></span>
                <p>没有找到匹配的文章</p>
                <button type="button" onClick={clearFilters}>查看全部文章</button>
              </div>
            )}
          </section>

          {pagination && !error && !query && (
            <Pagination
              disabled={loading}
              page={pagination.page}
              perPage={pagination.per_page}
              total={pagination.total}
              onPageChange={handlePageChange}
            />
          )}
        </main>

        <BrowseSidebar pageCount={visiblePosts.length} />
      </div>
    </div>
  )
}
