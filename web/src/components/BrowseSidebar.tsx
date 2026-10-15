import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { fetchPosts } from '@/api/posts'
import { fetchTags } from '@/api/tags'
import { useAuthStore } from '@/stores'
import type { Post, Tag } from '@/types'
import { Archive, ArrowUpRight, BookOpen, Books, Code, FileText, Hash, Notebook, PenNib, Sparkle } from './blogIcons'
import AuthorAvatar from './AuthorAvatar'
import './BrowseSidebar.css'

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export default function BrowseSidebar({ pageCount }: { pageCount?: number }) {
  const authenticated = useAuthStore((state) => state.authenticated)
  const [posts, setPosts] = useState<Post[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [articleCount, setArticleCount] = useState<number>()
  const [tagCount, setTagCount] = useState<number>()
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    Promise.all([fetchPosts({ page: 1, per_page: 4, status: 'published', kind: 'article' }), fetchTags('article')])
      .then(([articles, topics]) => {
        if (!active) return
        setPosts(articles.data)
        setArticleCount(articles.meta.total)
        setTags(topics.data)
        setTagCount(topics.data.length)
        setError(false)
      })
      .catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [attempt])

  return (
    <aside className="blog-sidebar" aria-label="博客信息">
      <section className="blog-sidebar-card blog-sidebar-profile scroll-mt-28">
        <AuthorAvatar className="blog-sidebar-profile__avatar" />
        <h2>bba70</h2>
        <p className="blog-sidebar-profile__roles"><Code size={16} aria-hidden="true" /> 独立开发者 <span>/</span> <PenNib size={15} aria-hidden="true" /> 写作者</p>
        <p className="blog-sidebar-profile__bio">在代码、产品与日常之间，记录值得长期保留的想法。</p>
        <dl>
          <div><dt><FileText size={15} aria-hidden="true" />文章</dt><dd>{articleCount ?? '—'}</dd></div>
          <div><dt><Hash size={15} aria-hidden="true" />标签</dt><dd>{tagCount ?? '—'}</dd></div>
          <div><dt><Books size={15} aria-hidden="true" />本页</dt><dd>{pageCount ?? '—'}</dd></div>
        </dl>
        <nav className="blog-sidebar-profile__nav" aria-label="博客内容入口">
          <Link to="/blog"><span className="blog-icon-tile blog-icon-tile--blue"><BookOpen size={23} weight="duotone" aria-hidden="true" /></span><span>文章</span></Link>
          {authenticated && <Link to="/essays"><span className="blog-icon-tile blog-icon-tile--green"><Notebook size={23} weight="duotone" aria-hidden="true" /></span><span>随笔</span></Link>}
          <Link to="/archive"><span className="blog-icon-tile blog-icon-tile--amber"><Archive size={23} weight="duotone" aria-hidden="true" /></span><span>归档</span></Link>
        </nav>
      </section>

      {error && <p className="blog-sidebar-status" role="status">侧栏数据暂时无法加载。<button type="button" onClick={() => setAttempt((value) => value + 1)}>重试</button></p>}
      <section className="blog-sidebar-card blog-sidebar-note">
        <h2><Sparkle size={23} weight="duotone" aria-hidden="true" />站点说明</h2>
        <p>这里没有固定更新频率。写作是整理思考的方式，也是一份公开的长期记忆。</p>
      </section>

      {posts.length > 0 && (
        <section className="blog-sidebar-card blog-sidebar-recent">
          <h2><BookOpen size={23} weight="duotone" aria-hidden="true" />最近文章</h2>
          <div>
            {posts.slice(0, 4).map((post) => (
              <Link key={post.id} to={`/posts/${post.slug}`}>
                <FileText className="blog-sidebar-recent__icon" size={17} weight="duotone" aria-hidden="true" />
                <span className="blog-sidebar-recent__text"><span>{post.title}</span><time dateTime={post.published_at ?? post.created_at}>{formatDate(post.published_at ?? post.created_at)}</time></span>
                <ArrowUpRight className="blog-sidebar-recent__arrow" size={16} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {tags.length > 0 && (
        <section className="blog-sidebar-card blog-sidebar-tags scroll-mt-28">
          <h2><Hash size={23} weight="duotone" aria-hidden="true" />主题标签</h2>
          <div>
            {tags.slice(0, 12).map((tag) => (
              <Link key={tag.id} to={`/topics?tag=${encodeURIComponent(tag.name)}`}><Hash size={13} aria-hidden="true" />{tag.name}</Link>
            ))}
          </div>
        </section>
      )}
    </aside>
  )
}
