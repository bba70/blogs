import { useEffect, useMemo } from 'react'
import { LazyMotion, useReducedMotion } from 'motion/react'
import * as motion from 'motion/react-m'
import { Link, useSearchParams } from 'react-router'
import { useAuthStore, usePostStore, useTagStore } from '@/stores'
import PostCard from '@/components/PostCard'
import PostCover from '@/components/PostCover'
import ProfileSidebar from '@/components/ProfileSidebar'
import Pagination from '@/components/Pagination'
import LoadingSpinner from '@/components/LoadingSpinner'
import ErrorMessage from '@/components/ErrorMessage'
import TagBadge from '@/components/TagBadge'
import StatusBadge from '@/components/StatusBadge'
import useArticleReveal from '@/hooks/useArticleReveal'
import { ArrowDown, Books, Calendar, Clock, Envelope, GithubLogo, Rss, Sparkle, X } from '@/components/blogIcons'
import RevealText from '@/components/home/RevealText'
import './HomePage.css'

const loadMotionFeatures = () => import('@/components/headerMotionFeatures').then((module) => module.default)

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
  const reducedMotion = useReducedMotion()
  const entrance = (delay: number) => ({
    initial: { opacity: 1, transform: 'none' },
    animate: reducedMotion ? { opacity: 1, transform: 'none' } : {
      opacity: [0.65, 1], transform: ['translateY(8px)', 'translateY(0px)'],
    },
    transition: { duration: reducedMotion ? 0 : 0.45, delay: reducedMotion ? 0 : delay, ease: [0.23, 1, 0.32, 1] as const },
  })
  const featuredRef = useArticleReveal()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Number(searchParams.get('page')) || 1
  const activeTag = searchParams.get('tag') ?? undefined
  const query = searchParams.get('q')?.trim().toLocaleLowerCase('zh-CN') ?? ''

  const { posts, pagination, loading, error, fetchPosts } = usePostStore()
  const { tags, fetchTags } = useTagStore()
  const authenticated = useAuthStore((state) => state.authenticated)

  useEffect(() => {
    fetchTags()
  }, [fetchTags])

  useEffect(() => {
    fetchPosts({ page, per_page: 10, tag: activeTag, status: 'published', kind: 'article' })
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
    document.querySelector('#articles')?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth' })
  }

  function clearFilters() {
    setSearchParams({})
  }

  return (
    <LazyMotion features={loadMotionFeatures} strict>
    <div>
      <section id="home" className="home-hero scroll-mt-[var(--header-height)]" aria-labelledby="home-title">
        <div className="home-hero__glow" aria-hidden="true" />
        <div className="home-hero__inner">
          <p className="home-hero__welcome">你好，欢迎来到逃跑计划。</p>
          <h1 id="home-title" className="home-hero__title" aria-label="我是 bba70。">
            <span className="home-hero__intro" aria-hidden="true"><RevealText text="我是" /></span>
            <span className="home-hero__name" aria-hidden="true"><RevealText text="bba70。" /></span>
          </h1>
          <motion.p {...entrance(0.08)} className="home-hero__description">
            <span>一名独立开发者与写作者，</span>
            <span>在这里记录代码、产品与生活。</span>
          </motion.p>

          <motion.div {...entrance(0.16)} className="home-hero__latest">
            <Sparkle size={18} weight="duotone" className="shrink-0 text-primary" aria-hidden="true" />
            {featuredPost ? (
              <Link to={`/posts/${featuredPost.slug}`} className="truncate underline-offset-4 transition-colors hover:text-primary hover:underline">
                最新文章：{featuredPost.title}
              </Link>
            ) : (
              <span>{loading ? '正在整理最新的记录…' : '思考不止，记录不断。'}</span>
            )}
          </motion.div>

          <div className="home-hero__socials" aria-label="联系方式">
            <span className="social-button" title="GitHub 链接待配置" aria-label="GitHub 链接待配置">
              <GithubLogo size={20} aria-hidden="true" />
            </span>
            <span className="social-button" title="邮箱待配置" aria-label="邮箱待配置"><Envelope size={20} aria-hidden="true" /></span>
            <span className="social-button" title="RSS 待配置" aria-label="RSS 待配置"><Rss size={20} aria-hidden="true" /></span>
          </div>

          <a href="#articles" className="hero-scroll" aria-label="向下查看文章"><ArrowDown size={20} aria-hidden="true" /></a>
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] px-5 py-14 sm:px-8 sm:py-20">
      <p className="mb-9 text-sm tracking-wide text-muted">继续阅读，看看最近在思考什么</p>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start xl:gap-12">
        <div className="min-w-0">
          <section aria-labelledby="featured-title">
            <h2 id="featured-title" className="mb-4 flex items-center gap-2 text-lg font-semibold tracking-tight">
              <Sparkle size={24} weight="duotone" className="shrink-0 text-primary" aria-hidden="true" />
              {activeTag || query ? '筛选结果' : '本周精选'}
            </h2>

            {loading && posts.length === 0 ? (
              <LoadingSpinner />
            ) : error ? (
              <ErrorMessage message={error} onRetry={() => fetchPosts({ page, per_page: 10, tag: activeTag, status: 'published', kind: 'article' })} />
            ) : featuredPost ? (
              <article ref={featuredRef} className="home-featured featured-article grid overflow-hidden rounded-[14px] border border-line bg-white p-4 sm:p-5 md:grid-cols-[1.1fr_0.95fr]">
                <PostCover src={featuredPost.cover_url} className="feature-art featured-post-cover" fallback={<div className="feature-art" aria-hidden="true">
                  <span className="absolute top-[14%] left-[7%] z-10 text-xs font-medium text-primary">写作</span>
                  <span className="absolute top-[22%] left-[7%] z-10 max-w-28 text-sm leading-7 text-muted">是重组思考的隐形工程。</span>
                  <span className="feature-dots" />
                  <span className="feature-accent" />
                  <span className="feature-word">思考</span>
                </div>} />

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
                    <time className="inline-flex items-center gap-1.5"><Calendar size={14} aria-hidden="true" />{formatDate(featuredPost.published_at ?? featuredPost.created_at)}</time>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1.5"><Clock size={14} aria-hidden="true" />{readingMinutes(featuredPost.content)} 分钟</span>
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
                {(query || authenticated) && (
                  <Link to={query ? '/' : '/editor'} className="mt-5 inline-flex rounded-[10px] bg-primary px-4 py-2 text-sm text-white hover:bg-primary-dark">
                    {query ? '清除搜索' : '新建文章'}
                  </Link>
                )}
              </div>
            )}
          </section>

          <section id="articles" className="scroll-mt-28 pt-9" aria-labelledby="all-posts-title">
            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 id="all-posts-title" className="flex items-center gap-2 text-lg font-semibold tracking-tight"><Books size={24} weight="duotone" className="shrink-0 text-primary" aria-hidden="true" />所有文章</h2>
              {(activeTag || query) && (
                <button type="button" onClick={clearFilters} className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm text-primary hover:text-primary-dark">
                  <X size={15} aria-hidden="true" />清除筛选
                </button>
              )}
            </div>

            {remainingPosts.length > 0 ? (
              <div className="grid gap-4">
                {remainingPosts.map((post, index) => <PostCard key={post.id} post={post} index={index} />)}
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
    </div>
    </LazyMotion>
  )
}
