import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { fetchArchivePosts } from '@/api/posts'
import ErrorMessage from '@/components/ErrorMessage'
import LoadingSpinner from '@/components/LoadingSpinner'
import ArchiveCover from '@/components/ArchiveCover'
import type { Post } from '@/types'
import './ArchivePage.css'

// Keep month boundaries and displayed dates consistent across visitor time zones.
const archiveDate = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
})

export default function ArchivePage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setLoading(true)
      setError('')
      try {
        const result = await fetchArchivePosts(controller.signal)
        if (!controller.signal.aborted) setPosts(result)
      } catch {
        if (!controller.signal.aborted) setError('归档暂时无法加载，请稍后重试。')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [attempt])

  const months = useMemo(() => {
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
  }, [posts])

  return (
    <div className="archive-page">
      <header className="archive-intro">
        <p className="archive-eyebrow">ARCHIVE / 时间里的记录</p>
        <h1>文章归档</h1>
        <p className="archive-description">每一次记录，都有迹可循。按月翻阅过去的写作与思考。</p>
      </header>

      <section className="archive-content" aria-label="月度文章归档" aria-live="polite" aria-busy={loading}>
        {loading ? <LoadingSpinner /> : error ? (
          <ErrorMessage message={error} onRetry={() => setAttempt((value) => value + 1)} />
        ) : posts.length === 0 ? (
          <div className="archive-empty">
            <span aria-hidden="true">○</span>
            <h2>时间线，等待第一篇记录</h2>
            <p>文章发布后，会按月份收录在这里。</p>
            <Link to="/blog">浏览文章 →</Link>
          </div>
        ) : (
          <div className="archive-timeline">
            <div className="archive-total"><h2>全部文章 <span>· {posts.length} 篇</span></h2></div>
            {months.map(([month, entries], index) => {
              const year = month.slice(0, 4)
              const showYear = index === 0 || months[index - 1][0].slice(0, 4) !== year
              return (
                <div key={month}>
                  {showYear && <h2 className="archive-year">{year}<span>年</span></h2>}
                  <section className="archive-month" aria-labelledby={`month-${month}`}>
                    <div className="archive-month-heading">
                      <h3 id={`month-${month}`}>{month.slice(5)}<span>月</span></h3>
                      <span>{entries.length} 篇文章</span>
                    </div>
                    <ol className="archive-entries">
                      {entries.map(({ post, date }) => (
                        <li key={post.id} className="archive-entry">
                          <Link to={`/posts/${encodeURIComponent(post.slug)}`}>
                            <ArchiveCover content={post.content} coverURL={post.cover_url} />
                            <div className="archive-entry__text">
                            <time dateTime={post.published_at ?? post.created_at}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                                <rect x="4" y="5" width="16" height="16" rx="2" />
                                <path d="M8 3v4m8-4v4M4 11h16m-12 4h2m4 0h2m-8 3h2" />
                              </svg>
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
          </div>
        )}
      </section>
    </div>
  )
}
