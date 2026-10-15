import { useMemo, useState } from 'react'
import { LazyMotion } from 'motion/react'
import { Link, useSearchParams } from 'react-router'
import { ArrowRight, ArrowUpRight, Books, Hash, Notebook } from '@/components/blogIcons'
import ErrorMessage from '@/components/ErrorMessage'
import LoadingSpinner from '@/components/LoadingSpinner'
import StatusBadge from '@/components/StatusBadge'
import BrowseSidebar from '@/components/BrowseSidebar'
import SpotlightCard from '@/components/effects/SpotlightCard'
import RevealText from '@/components/home/RevealText'
import { useAuthStore } from '@/stores'
import { useTopicPosts, useTopicTags } from '@/hooks/useTopics'
import type { Post, PostKind, Tag } from '@/types'
import './TopicsPage.css'

const loadMotionFeatures = () => import('@/components/headerMotionFeatures').then((module) => module.default)
const topicDate = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' })
const postDate = (post: Post) => post.status === 'draft' ? post.created_at : post.published_at ?? post.created_at

function TopicList({ posts, kind }: { posts: Post[]; kind: PostKind }) {
  const title = kind === 'article' ? '文章' : '随笔'
  const Icon = kind === 'article' ? Books : Notebook
  return (
    <section className="topics-results__group" aria-labelledby={`topics-${kind}`}>
      <h3 id={`topics-${kind}`}><Icon size={23} weight="duotone" aria-hidden="true" />{title}<span>{posts.length} 篇</span></h3>
      {posts.length === 0 ? <p className="topics-empty">此标签下暂无{title}。</p> : (
        <ul className="topics-posts">
          {posts.map((post) => (
            <li key={post.id}>
              <div className="topics-posts__meta">
                <time dateTime={postDate(post)}>{topicDate.format(new Date(postDate(post)))}</time>
                {post.status === 'draft' && <StatusBadge status="draft" />}
              </div>
              <Link className="topics-posts__title" to={`/posts/${encodeURIComponent(post.slug)}`}>{post.title}<ArrowUpRight size={17} aria-hidden="true" /></Link>
              {post.summary && <p>{post.summary}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function TopicCards({ tags, posts, ready, failed, isOwner }: { tags: Tag[]; posts: Post[]; ready: boolean; failed: boolean; isOwner: boolean }) {
  return (
    <nav className="topics-directory" aria-label="按标签浏览">
      {tags.map((tag, index) => {
        const related = posts.filter((post) => post.tags.includes(tag.name))
        const articles = related.filter((post) => post.kind === 'article').length
        const essays = related.length - articles
        const latest = related[0]
        return (
          <SpotlightCard key={tag.name} className={`topic-card topic-card--${index % 2 === 0 ? 'blue' : 'green'}`}>
            <Link to={`/topics?tag=${encodeURIComponent(tag.name)}`} className="topic-card__link">
              <div className="topic-card__heading"><Hash size={27} weight="duotone" aria-hidden="true" /><ArrowUpRight size={21} aria-hidden="true" /></div>
              <h3>{tag.name}</h3>
              <p className="topic-card__counts">{ready ? <><span>{articles} 篇文章</span>{isOwner && <span>{essays} 篇随笔</span>}</> : failed ? '篇数暂不可用' : '正在整理相关记录'}</p>
              <div className="topic-card__latest">
                <span>{latest ? <>最近记录 · <time dateTime={postDate(latest)}>{topicDate.format(new Date(postDate(latest)))}</time></> : '进入专题'}</span>
                <p>{latest?.title ?? (ready ? '看看这个主题下的思考与记录' : isOwner ? '查看相关的文章与随笔' : '查看相关文章')}<ArrowRight size={16} aria-hidden="true" /></p>
              </div>
            </Link>
          </SpotlightCard>
        )
      })}
    </nav>
  )
}

function RecentTopicPosts({ posts }: { posts: Post[] }) {
  return (
    <section className="topics-recent" aria-labelledby="topics-recent-title">
      <div className="topics-section-heading"><h2 id="topics-recent-title">最近的专题记录</h2><span>沿着标签，继续阅读</span></div>
      <ul className="topics-recent__list">
        {posts.slice(0, 5).map((post) => (
          <li key={post.id}>
            <Link to={`/posts/${encodeURIComponent(post.slug)}`}>
              <span className={`topics-recent__icon topics-recent__icon--${post.kind}`} aria-hidden="true">{post.kind === 'article' ? <Books size={24} weight="duotone" /> : <Notebook size={24} weight="duotone" />}</span>
              <div className="topics-recent__text">
                <div className="topics-posts__meta"><span>{post.kind === 'article' ? '文章' : '随笔'}</span><time dateTime={postDate(post)}>{topicDate.format(new Date(postDate(post)))}</time>{post.status === 'draft' && <StatusBadge status="draft" />}</div>
                <h3>{post.title}</h3><p>{post.tags.map((tag) => `# ${tag}`).join('　')}</p>
              </div>
              <ArrowUpRight className="topics-recent__arrow" size={20} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function TopicsContent({ isOwner, onRetry }: { isOwner: boolean; onRetry: () => void }) {
  const [searchParams] = useSearchParams()
  const tag = searchParams.get('tag') || ''
  const topics = useTopicTags(isOwner)
  // Load once for directory counts and previews, then filter selected topics locally.
  const records = useTopicPosts('', isOwner)
  const posts = useMemo(() => [...records.articles, ...records.essays]
    .filter((post) => post.tags.length > 0)
    .sort((a, b) => Date.parse(postDate(b)) - Date.parse(postDate(a)) || b.id - a.id), [records.articles, records.essays])
  const articles = records.articles.filter((post) => post.tags.includes(tag))
  const essays = records.essays.filter((post) => post.tags.includes(tag))
  const ready = !records.loading && !records.error

  return (
    <div className="topics-shell topics-body">
      <div className="topics-main">
        <section className="topics-tags" aria-labelledby="topics-directory-title" aria-busy={topics.loading}>
          <div className="topics-section-heading">
            <div><h2 id="topics-directory-title">{tag ? '浏览专题' : '从一个主题开始'}</h2>{!tag && <p>把零散的记录，连成自己的阅读路径。</p>}</div>
            {!topics.loading && !topics.error && <span>{topics.tags.length} 个专题</span>}
          </div>
          {topics.loading ? <div className="topics-loading" role="status" aria-label="正在加载标签"><LoadingSpinner /></div> : topics.error ? (
            <ErrorMessage message="标签暂时无法加载，请稍后重试。" onRetry={onRetry} />
          ) : topics.tags.length === 0 ? (
            <div className="topics-empty-state"><Hash size={32} aria-hidden="true" /><h3>主题，来自每一次记录</h3><p>{isOwner ? '为文章或随笔添加标签后，它们会在这里汇成专题。' : '已发布文章的标签会在这里汇成专题。'}</p><Link to="/blog">先去看看文章 <ArrowRight size={16} aria-hidden="true" /></Link></div>
          ) : tag ? (
            <nav className="topics-tags__list" aria-label="按标签浏览">
              <Link to="/topics">全部专题</Link>
              {topics.tags.map((topic) => <Link key={topic.name} to={`/topics?tag=${encodeURIComponent(topic.name)}`} aria-current={tag === topic.name ? 'page' : undefined}><Hash size={16} aria-hidden="true" /><span>{topic.name}</span></Link>)}
            </nav>
          ) : <TopicCards tags={topics.tags} posts={posts} ready={ready} failed={records.error} isOwner={isOwner} />}
        </section>

        <div aria-busy={records.loading} aria-live="polite">
          {records.loading ? <div className="topics-loading" role="status" aria-label="正在加载专题内容"><LoadingSpinner /></div> : records.error ? <ErrorMessage message="专题内容暂时无法加载，请稍后重试。" onRetry={onRetry} /> : tag ? (
            <section className="topics-results" aria-labelledby="topic-results-title">
              <div className="topics-results__heading"><h2 id="topic-results-title"><Hash size={24} aria-hidden="true" />{tag}</h2><p>共 {articles.length + essays.length} 篇记录</p></div>
              <div className={`topics-results__columns${isOwner ? '' : ' topics-results__columns--articles'}`}><TopicList posts={articles} kind="article" />{isOwner && <TopicList posts={essays} kind="essay" />}</div>
            </section>
          ) : posts.length > 0 ? <RecentTopicPosts posts={posts} /> : null}
        </div>
      </div>
      <BrowseSidebar pageCount={ready ? (tag ? articles.length + essays.length : posts.length) : undefined} />
    </div>
  )
}

function TopicsBrowser({ isOwner }: { isOwner: boolean }) {
  const [attempt, setAttempt] = useState(0)
  return <TopicsContent key={attempt} isOwner={isOwner} onRetry={() => setAttempt((value) => value + 1)} />
}

export default function TopicsPage() {
  const { authenticated, initialized } = useAuthStore()
  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <div className="topics-page">
        <header className="topics-hero">
          <div className="topics-shell"><h1><Hash size={34} weight="duotone" aria-hidden="true" /><RevealText text="专题" /></h1><p>以标签为线索，串起代码、产品与生活的记录。</p><p className="topics-hero__scope">{authenticated ? '作者视角 · 包含已发布内容与草稿' : '浏览已发布的文章'}</p></div>
        </header>
        {!initialized ? <div className="topics-shell topics-body"><LoadingSpinner /><BrowseSidebar /></div> : <TopicsBrowser key={authenticated ? 'owner' : 'visitor'} isOwner={authenticated} />}
      </div>
    </LazyMotion>
  )
}
