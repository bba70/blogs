import { Link } from 'react-router'
import type { Post, Tag } from '@/types'
import { Archive, ArrowRight, Calendar, Code, Envelope, FileText, GithubLogo, Hash, PenNib, Rss, Sparkle } from './blogIcons'
import AuthorAvatar from './AuthorAvatar'

interface ProfileSidebarProps {
  articleCount: number
  posts: Post[]
  tags: Tag[]
}

export default function ProfileSidebar({ articleCount, posts, tags }: ProfileSidebarProps) {
  const archive = posts.reduce<Record<string, number>>((years, post) => {
    const year = String(new Date(post.published_at ?? post.created_at).getFullYear())
    years[year] = (years[year] ?? 0) + 1
    return years
  }, {})
  const archiveRows = Object.entries(archive).sort(([a], [b]) => Number(b) - Number(a))

  return (
    <aside className="space-y-5 lg:sticky lg:top-[100px] lg:self-start">
      <section id="about" className="scroll-mt-28 rounded-[14px] border border-line bg-white p-7 text-center">
        <AuthorAvatar className="mx-auto h-28 w-28 rounded-full border border-line bg-white" />
        <h2 className="mt-5 text-2xl font-semibold tracking-tight">bba70</h2>
        <p className="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-sm text-muted"><Code size={16} aria-hidden="true" />独立开发者 / <PenNib size={16} aria-hidden="true" />写作者</p>

        <dl className="mt-7 grid grid-cols-3 border-y border-line py-5">
          <div>
            <dt className="flex items-center justify-center gap-1 text-xs text-muted"><FileText size={14} aria-hidden="true" />文章</dt>
            <dd className="mt-1 text-xl font-medium text-ink">{articleCount}</dd>
          </div>
          <div className="border-x border-line">
            <dt className="flex items-center justify-center gap-1 text-xs text-muted"><Hash size={14} aria-hidden="true" />标签</dt>
            <dd className="mt-1 text-xl font-medium text-ink">{tags.length}</dd>
          </div>
          <div>
            <dt className="flex items-center justify-center gap-1 text-xs text-muted"><Calendar size={14} aria-hidden="true" />年份</dt>
            <dd className="mt-1 text-xl font-medium text-ink">{archiveRows.length}</dd>
          </div>
        </dl>

        <div className="mt-5 flex items-center justify-center gap-7 text-xs font-semibold tracking-wider text-muted" aria-label="社交链接待配置">
          <span title="GitHub 链接待配置" aria-label="GitHub 链接待配置"><GithubLogo size={20} aria-hidden="true" /></span>
          <span title="邮箱链接待配置" aria-label="邮箱链接待配置"><Envelope size={20} aria-hidden="true" /></span>
          <span title="RSS 链接待配置" aria-label="RSS 链接待配置"><Rss size={20} aria-hidden="true" /></span>
        </div>
      </section>

      <section id="topics" className="scroll-mt-28 rounded-[14px] border border-line bg-white p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eef0fb] text-primary" aria-hidden="true"><Sparkle size={23} weight="duotone" /></span>
          <div>
            <h2 className="font-semibold">正在探索</h2>
            <p className="mt-1 text-sm leading-6 text-muted">AI 辅助写作，但保留人的判断</p>
          </div>
        </div>
        {tags.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-5">
            {tags.slice(0, 6).map((tag) => (
              <Link key={tag.id} to={`/topics?tag=${encodeURIComponent(tag.name)}`} className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs text-muted hover:border-primary hover:text-primary [@media(pointer:coarse)]:min-h-11">
                <Hash size={12} className="shrink-0" aria-hidden="true" />{tag.name}
              </Link>
            ))}
          </div>
        )}
        <Link to="/topics" className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm text-primary hover:text-primary-dark">查看全部专题标签 <ArrowRight size={16} aria-hidden="true" /></Link>
      </section>

      <section id="archive" className="scroll-mt-28 rounded-[14px] border border-line bg-white p-6">
        <h2 className="flex items-center gap-2 font-semibold"><Archive size={23} weight="duotone" className="text-[#946530]" aria-hidden="true" />归档</h2>
        <div className="mt-4 divide-y divide-line">
          {archiveRows.length > 0 ? archiveRows.map(([year, count]) => (
            <div key={year} className="flex items-center justify-between py-4 first:pt-1 last:pb-0">
              <span className="text-lg font-medium">{year}</span>
              <span className="inline-flex items-center gap-2 text-sm text-muted">{count} 篇 <ArrowRight size={15} aria-hidden="true" /></span>
            </div>
          )) : (
            <p className="py-3 text-sm text-muted">发布文章后将在这里形成时间线。</p>
          )}
        </div>
        <Link to="/archive" className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm text-primary hover:text-primary-dark">查看完整月度归档 <ArrowRight size={16} aria-hidden="true" /></Link>
      </section>
    </aside>
  )
}
