import { useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import ErrorMessage from '@/components/ErrorMessage'
import LoadingSpinner from '@/components/LoadingSpinner'
import Pagination from '@/components/Pagination'
import PostCover from '@/components/PostCover'
import { usePostStore, useTagStore } from '@/stores'
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
  const artStyle = ['orbit', 'grid', 'type'][Math.abs(post.id) % 3]

  return (
    <article ref={revealRef} className="blog-list-item">
      <div className="blog-list-item__content">
        <div className="blog-list-item__eyebrow">
          {featured && <span className="blog-list-item__latest">最新</span>}
          <span>{post.tags[0] ?? '随笔'}</span>
        </div>
        <Link to={`/posts/${post.slug}`} className="blog-list-item__title-link">
          <h2>{post.title}</h2>
        </Link>
        <p className="blog-list-item__summary">
          {post.summary || '这篇文章暂时没有摘要，点击标题继续阅读全文。'}
        </p>
        <div className="blog-list-item__meta">
          <time dateTime={post.published_at ?? post.created_at}>
            {formatDate(post.published_at ?? post.created_at)}
          </time>
          <span aria-hidden="true">·</span>
          <span>{readingMinutes(post.content)} 分钟阅读</span>
          {post.tags.slice(0, 3).map((tag) => (
            <Link key={tag} to={`/blog?tag=${encodeURIComponent(tag)}`} className="blog-list-item__tag">
              #{tag}
            </Link>
          ))}
        </div>
      </div>

      <PostCover src={post.cover_url} className="blog-post-art blog-post-cover" fallback={<div className={`blog-post-art blog-post-art--${artStyle}`} aria-hidden="true">
        <span>{post.title.slice(0, 1)}</span>
      </div>} />
    </article>
  )
}

export default function BlogPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Number(searchParams.get('page')) || 1
  const activeTag = searchParams.get('tag') ?? undefined
  const query = searchParams.get('q')?.trim().toLocaleLowerCase('zh-CN') ?? ''
  const perPage = query ? 100 : PAGE_SIZE

  const { posts, pagination, loading, error, fetchPosts } = usePostStore()
  const { tags, fetchTags } = useTagStore()

  useEffect(() => {
    fetchTags()
  }, [fetchTags])

  useEffect(() => {
    fetchPosts({ page: query ? 1 : page, per_page: perPage, tag: activeTag, status: 'published' })
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
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function selectTag(tag?: string) {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      next.delete('page')
      if (tag) next.set('tag', tag)
      else next.delete('tag')
      return next
    })
  }

  function clearFilters() {
    setSearchParams({})
  }

  return (
    <div className="blog-index-page">
      <header className="blog-index-hero">
        <div className="blog-index-shell">
          <p className="blog-index-hero__eyebrow">JOURNAL / 写作与思考</p>
          <div className="blog-index-hero__title-row">
            <div>
              <h1>全部文章</h1>
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
          <section className="blog-index-filters" aria-label="文章筛选">
            <div className="blog-index-filters__tags">
              <button type="button" onClick={() => selectTag()} aria-pressed={!activeTag}>
                全部
              </button>
              {tags.slice(0, 8).map((tag) => (
                <button
                  type="button"
                  key={tag.id}
                  onClick={() => selectTag(tag.name)}
                  aria-pressed={activeTag === tag.name}
                >
                  {tag.name}
                </button>
              ))}
            </div>
            {(activeTag || query) && (
              <button type="button" onClick={clearFilters} className="blog-index-filters__clear">
                清除筛选
              </button>
            )}
          </section>

          {query && (
            <p className="blog-index-result-note">
              “{searchParams.get('q')}” 的搜索结果 · {visiblePosts.length} 篇
            </p>
          )}

          <section className="blog-list" aria-label="文章列表" aria-live="polite">
            {loading && posts.length === 0 ? (
              <LoadingSpinner />
            ) : error ? (
              <ErrorMessage
                message={error}
                onRetry={() => fetchPosts({ page: query ? 1 : page, per_page: perPage, tag: activeTag, status: 'published' })}
              />
            ) : visiblePosts.length > 0 ? (
              visiblePosts.map((post, index) => <BlogListItem key={post.id} post={post} index={index} featured={page === 1 && index === 0} />)
            ) : (
              <div className="blog-index-empty">
                <p>没有找到匹配的文章</p>
                <button type="button" onClick={clearFilters}>查看全部文章</button>
              </div>
            )}
          </section>

          {pagination && !query && (
            <Pagination
              page={pagination.page}
              perPage={pagination.per_page}
              total={pagination.total}
              onPageChange={handlePageChange}
            />
          )}
        </main>

        <aside className="blog-sidebar" aria-label="博客信息">
          <section className="blog-sidebar-card blog-sidebar-profile">
            <div className="blog-sidebar-profile__avatar" aria-hidden="true"><span className="profile-mark" /></div>
            <h2>bba70</h2>
            <p>独立开发者 / 写作者</p>
            <p className="blog-sidebar-profile__bio">在代码、产品与日常之间，记录值得长期保留的想法。</p>
            <dl>
              <div><dt>文章</dt><dd>{pagination?.total ?? posts.length}</dd></div>
              <div><dt>标签</dt><dd>{tags.length}</dd></div>
              <div><dt>本页</dt><dd>{visiblePosts.length}</dd></div>
            </dl>
          </section>

          <section className="blog-sidebar-card blog-sidebar-note">
            <h2><span aria-hidden="true">✦</span> 站点说明</h2>
            <p>这里没有固定更新频率。写作是整理思考的方式，也是一份公开的长期记忆。</p>
          </section>

          {posts.length > 0 && (
            <section className="blog-sidebar-card blog-sidebar-recent">
              <h2>最近文章</h2>
              <div>
                {posts.slice(0, 4).map((post) => (
                  <Link key={post.id} to={`/posts/${post.slug}`}>
                    <span>{post.title}</span>
                    <time>{formatDate(post.published_at ?? post.created_at)}</time>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {tags.length > 0 && (
            <section className="blog-sidebar-card blog-sidebar-tags">
              <h2>主题标签</h2>
              <div>
                {tags.slice(0, 12).map((tag) => (
                  <button type="button" key={tag.id} onClick={() => selectTag(tag.name)}>#{tag.name}</button>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}
