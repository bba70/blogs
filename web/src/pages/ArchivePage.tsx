import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useAuthStore } from '@/stores'
import { isApiError } from '@/api/client'
import { fetchArchivePosts } from '@/api/posts'
import ErrorMessage from '@/components/ErrorMessage'
import LoadingSpinner from '@/components/LoadingSpinner'
import ArchiveCover from '@/components/ArchiveCover'
import BrowseSidebar from '@/components/BrowseSidebar'
import { Archive, ArrowRight, Books, Calendar, Notebook } from '@/components/blogIcons'
import type { Post } from '@/types'
import './ArchivePage.css'

// Keep month boundaries and displayed dates consistent across visitor time zones.
const archiveDate = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
})

function groupByMonth(posts: Post[]) {
  const groups = new Map<string, { post: Post; date: string }[]>()
  const sorted = [...posts].sort((a, b) =>
    Date.parse(b.published_at ?? b.created_at) - Date.parse(a.published_at ?? a.created_at) || b.id - a.id,
  )
  for (const post of sorted) {
    const date = archiveDate.format(new Date(post.published_at ?? post.created_at))
    const key = date.slice(0, 7)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push({ post, date })
  }
  return [...groups.entries()]
}

// MonthTimeline 渲染一条独立的年月时间线；文章与随笔各用一条，互不混排。
function MonthTimeline({ heading, kind, posts, emptyHint }: { heading: string; kind: 'article' | 'essay'; posts: Post[]; emptyHint: string }) {
  const months = useMemo(() => groupByMonth(posts), [posts])
  const HeadingIcon = kind === 'article' ? Books : Notebook

  return (
    <div className="archive-timeline">
      <div className="archive-total"><h2><HeadingIcon size={26} weight="duotone" aria-hidden="true" />{heading} <span>· {posts.length} 篇</span></h2></div>
      {months.length === 0 ? (
        <p className="archive-end">{emptyHint}</p>
      ) : (
        <>
          {months.map(([month, entries], index) => {
            const year = month.slice(0, 4)
            const showYear = index === 0 || months[index - 1][0].slice(0, 4) !== year
            return (
              <div key={month}>
                {showYear && <h2 className="archive-year">{year}<span>年</span></h2>}
                <section className="archive-month" aria-labelledby={`${heading}-${month}`}>
                  <div className="archive-month-heading">
                    <h3 id={`${heading}-${month}`}>{month.slice(5)}<span>月</span></h3>
                    <span>{entries.length} 篇</span>
                  </div>
                  <ol className="archive-entries">
                    {entries.map(({ post, date }) => (
                      <li key={post.id} className="archive-entry">
                        <Link to={`/posts/${encodeURIComponent(post.slug)}`}>
                          <ArchiveCover content={post.content} coverURL={post.cover_url} />
                          <div className="archive-entry__text">
                          <time dateTime={post.published_at ?? post.created_at}>
                            <Calendar size={15} aria-hidden="true" />
                            {date}
                          </time>
                          <h4>{post.title}</h4>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ol>
                </section>
              </div>
            )
          })}
          <p className="archive-end">记录还在继续</p>
        </>
      )}
    </div>
  )
}

function ArchiveContent({ isOwner }: { isOwner: boolean }) {
  const [activeKind, setActiveKind] = useState<'article' | 'essay'>('article')
  const [articlePosts, setArticlePosts] = useState<Post[]>([])
  const [essayPosts, setEssayPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setLoading(true)
      setError('')
      try {
        const articles = await fetchArchivePosts('article', controller.signal)
        if (controller.signal.aborted) return
        setArticlePosts(articles)

        const essays = isOwner ? await fetchArchivePosts('essay', controller.signal) : []
        if (controller.signal.aborted) return
        setEssayPosts(essays)
      } catch (error) {
        if (!controller.signal.aborted && isApiError(error) && error.status === 401) useAuthStore.getState().expireSession()
        if (!controller.signal.aborted) setError('归档暂时无法加载，请稍后重试。')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [attempt, isOwner])

  const activePosts = activeKind === 'article' ? articlePosts : essayPosts
  const activeLabel = activeKind === 'article' ? '文章' : '随笔'

  return (
    <div className="archive-page">
      <header className="archive-intro">
        <p className="archive-eyebrow">ARCHIVE / 时间里的记录</p>
        <h1><span className="page-title-icon page-title-icon--amber"><Archive size={36} weight="duotone" aria-hidden="true" /></span>归档</h1>
        <p className="archive-description">
          {isOwner ? '每一次记录，都有迹可循。文章与随笔各自成一条时间线，按月翻阅。' : '每一次记录，都有迹可循。按月翻阅已发布的文章。'}
        </p>
      </header>

      <div className="archive-layout">
        <section className="archive-content" aria-label="月度归档" aria-live="polite" aria-busy={loading}>
          <div className="archive-kind-switch" role="group" aria-label="归档类型">
            <button type="button" aria-pressed={activeKind === 'article'} aria-controls="archive-timeline" onClick={() => setActiveKind('article')}>
              <Books size={18} aria-hidden="true" />文章{!loading && !error && <span>{articlePosts.length}</span>}
            </button>
            {isOwner && <button type="button" aria-pressed={activeKind === 'essay'} aria-controls="archive-timeline" onClick={() => setActiveKind('essay')}>
              <Notebook size={18} aria-hidden="true" />随笔{!loading && !error && <span>{essayPosts.length}</span>}
            </button>}
          </div>
          <div id="archive-timeline">
          {loading ? <LoadingSpinner /> : error ? (
            <ErrorMessage message={error} onRetry={() => setAttempt((value) => value + 1)} />
          ) : activePosts.length === 0 ? (
            <div className="archive-empty">
              <span aria-hidden="true"><Archive size={40} weight="duotone" /></span>
              <h2>还没有已发布的{activeLabel}</h2>
              <p>{activeLabel}发布后，会按月份收录在这里。</p>
              <Link to={activeKind === 'article' ? '/blog' : '/essays'}>浏览{activeLabel} <ArrowRight size={16} aria-hidden="true" /></Link>
            </div>
          ) : (
            <MonthTimeline
              heading={`${activeLabel}归档`}
              kind={activeKind}
              posts={activePosts}
              emptyHint={`还没有已发布的${activeLabel}。`}
            />
          )}
          </div>
        </section>
        <BrowseSidebar pageCount={activePosts.length} />
      </div>
    </div>
  )
}

export default function ArchivePage() {
  const { authenticated, initialized } = useAuthStore()
  if (!initialized) return <LoadingSpinner />
  return <ArchiveContent key={authenticated ? 'owner' : 'visitor'} isOwner={authenticated} />
}
