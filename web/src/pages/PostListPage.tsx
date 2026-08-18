import { useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { usePostStore, useTagStore } from '@/stores'
import PostCard from '@/components/PostCard'
import ProfileSidebar from '@/components/ProfileSidebar'
import Pagination from '@/components/Pagination'
import LoadingSpinner from '@/components/LoadingSpinner'
import ErrorMessage from '@/components/ErrorMessage'
import TagBadge from '@/components/TagBadge'
import StatusBadge from '@/components/StatusBadge'

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

export default function PostListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Number(searchParams.get('page')) || 1
  const activeTag = searchParams.get('tag') ?? undefined
  const query = searchParams.get('q')?.trim().toLocaleLowerCase('zh-CN') ?? ''

  const { posts, pagination, loading, error, fetchPosts } = usePostStore()
  const { tags, fetchTags } = useTagStore()

  useEffect(() => {
    fetchTags()
  }, [fetchTags])

  useEffect(() => {
    fetchPosts({ page, per_page: 10, tag: activeTag })
  }, [page, activeTag, fetchPosts])

  const visiblePosts = useMemo(() => {
    if (!query) return posts
    return posts.filter((post) =>
      [post.title, post.summary, ...post.tags].some((value) => value.toLocaleLowerCase('zh-CN').includes(query)),
    )
  }, [posts, query])

  const featuredPost = visiblePosts[0]
  const remainingPosts = visiblePosts.slice(1)

  function handlePageChange(nextPage: number) {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      next.set('page', String(nextPage))
      return next
    })
    document.querySelector('#articles')?.scrollIntoView({ behavior: 'smooth' })
  }

  function clearFilters() {
    setSearchParams({})
  }

  if (loading && posts.length === 0) return <LoadingSpinner />
  if (error) return <ErrorMessage message={error} onRetry={() => fetchPosts({ page, per_page: 10, tag: activeTag })} />

  return (
    <div className="mx-auto max-w-[1440px] px-5 py-10 sm:px-8 sm:py-12">
      <p className="mb-9 text-sm tracking-wide text-muted">一个关于代码、产品与创造力的个人空间</p>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start xl:gap-12">
        <div className="min-w-0">
          <section aria-labelledby="featured-title">
            <h1 id="featured-title" className="mb-4 text-lg font-semibold tracking-tight">
              {activeTag || query ? '筛选结果' : '本周精选'}
            </h1>

            {featuredPost ? (
              <article className="grid overflow-hidden rounded-[14px] border border-line bg-white md:grid-cols-[1.1fr_0.95fr]">
                <div className="feature-art" aria-hidden="true">
                  <span className="absolute top-[14%] left-[7%] z-10 text-xs font-medium text-primary">写作</span>
                  <span className="absolute top-[22%] left-[7%] z-10 max-w-28 text-sm leading-7 text-muted">是重组思考的隐形工程。</span>
                  <span className="feature-dots" />
                  <span className="feature-accent" />
                  <span className="feature-word">思考</span>
                </div>

                <div className="flex flex-col justify-between p-6 sm:p-8 lg:p-9">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-medium text-primary">
                      <span>{featuredPost.tags[0] ?? '写作'}</span>
                      {featuredPost.status === 'draft' && <StatusBadge status={featuredPost.status} />}
                    </div>
                    <Link to={`/posts/${featuredPost.slug}`}>
                      <h2 className="mt-5 text-3xl font-semibold leading-tight tracking-[-0.035em] text-ink transition-colors hover:text-primary sm:text-4xl">
                        {featuredPost.title}
                      </h2>
                    </Link>
                    <p className="mt-4 line-clamp-3 text-sm leading-7 text-muted">
                      {featuredPost.summary || '记录不是目的，梳理思考、沉淀认知、建立连接，才是写作的真正价值。'}
                    </p>
                  </div>

                  <div className="mt-8 flex flex-wrap items-center gap-3 text-xs text-muted">
                    <time>{formatDate(featuredPost.published_at ?? featuredPost.created_at)}</time>
                    <span aria-hidden="true">·</span>
                    <span>{readingMinutes(featuredPost.content)} 分钟</span>
                    <div className="ml-auto flex flex-wrap gap-1.5">
                      {featuredPost.tags.slice(0, 3).map((tag) => <TagBadge key={tag} name={tag} />)}
                    </div>
                  </div>
                </div>
              </article>
            ) : (
              <div className="rounded-[14px] border border-dashed border-line px-6 py-20 text-center">
                <p className="text-lg font-medium">{query ? '没有找到匹配的文章' : '这里还没有文章'}</p>
                <p className="mt-2 text-sm text-muted">{query ? '尝试其他关键词，或清除筛选条件。' : '从一篇值得记录的内容开始。'}</p>
                <Link to={query ? '/' : '/editor'} className="mt-5 inline-flex rounded-[10px] bg-primary px-4 py-2 text-sm text-white hover:bg-primary-dark">
                  {query ? '清除搜索' : '新建文章'}
                </Link>
              </div>
            )}
          </section>

          <section id="articles" className="scroll-mt-28 pt-9" aria-labelledby="all-posts-title">
            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 id="all-posts-title" className="text-lg font-semibold tracking-tight">所有文章</h2>
              {(activeTag || query) && (
                <button type="button" onClick={clearFilters} className="self-start text-sm text-primary hover:text-primary-dark">
                  清除筛选
                </button>
              )}
            </div>

            {tags.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={clearFilters}
                  className={`inline-flex min-h-7 items-center rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                    !activeTag ? 'border-primary bg-primary text-white' : 'border-line bg-white text-muted hover:text-ink'
                  }`}
                >
                  全部
                </button>
                {tags.slice(0, 8).map((tag) => <TagBadge key={tag.id} name={tag.name} active={activeTag === tag.name} />)}
              </div>
            )}

            {remainingPosts.length > 0 ? (
              <div className="overflow-hidden rounded-[14px] border border-line bg-white">
                {remainingPosts.map((post) => <PostCard key={post.id} post={post} />)}
              </div>
            ) : featuredPost ? (
              <div className="rounded-[14px] border border-line px-6 py-10 text-center text-sm text-muted">更多文章正在整理中。</div>
            ) : null}
          </section>

          {pagination && !query && (
            <Pagination
              page={pagination.page}
              perPage={pagination.per_page}
              total={pagination.total}
              onPageChange={handlePageChange}
            />
          )}
        </div>

        <ProfileSidebar articleCount={pagination?.total ?? posts.length} posts={posts} tags={tags} />
      </div>
    </div>
  )
}
