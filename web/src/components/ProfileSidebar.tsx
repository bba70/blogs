import type { Post, Tag } from '@/types'

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
        <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border border-line bg-white" aria-hidden="true">
          <span className="profile-mark" />
        </div>
        <h2 className="mt-5 text-2xl font-semibold tracking-tight">陈默</h2>
        <p className="mt-2 text-sm text-muted">独立开发者 / 写作者</p>

        <dl className="mt-7 grid grid-cols-3 border-y border-line py-5">
          <div>
            <dt className="text-xs text-muted">文章</dt>
            <dd className="mt-1 text-xl font-medium text-ink">{articleCount}</dd>
          </div>
          <div className="border-x border-line">
            <dt className="text-xs text-muted">标签</dt>
            <dd className="mt-1 text-xl font-medium text-ink">{tags.length}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">年份</dt>
            <dd className="mt-1 text-xl font-medium text-ink">{archiveRows.length}</dd>
          </div>
        </dl>

        <div className="mt-5 flex items-center justify-center gap-7 text-xs font-semibold tracking-wider text-muted" aria-label="社交链接待配置">
          <span title="GitHub 链接待配置">GH</span>
          <span title="邮箱链接待配置">MAIL</span>
          <span title="RSS 链接待配置">RSS</span>
        </div>
      </section>

      <section id="topics" className="scroll-mt-28 rounded-[14px] border border-line bg-white p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-primary text-lg text-primary" aria-hidden="true">↗</span>
          <div>
            <h2 className="font-semibold">正在探索</h2>
            <p className="mt-1 text-sm leading-6 text-muted">AI 辅助写作，但保留人的判断</p>
          </div>
        </div>
        {tags.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-5">
            {tags.slice(0, 6).map((tag) => (
              <a key={tag.id} href={`/?tag=${encodeURIComponent(tag.name)}#articles`} className="rounded-lg border border-line px-2.5 py-1 text-xs text-muted hover:border-primary hover:text-primary">
                {tag.name}
              </a>
            ))}
          </div>
        )}
      </section>

      <section id="archive" className="scroll-mt-28 rounded-[14px] border border-line bg-white p-6">
        <h2 className="font-semibold">归档</h2>
        <div className="mt-4 divide-y divide-line">
          {archiveRows.length > 0 ? archiveRows.map(([year, count]) => (
            <div key={year} className="flex items-center justify-between py-4 first:pt-1 last:pb-0">
              <span className="text-lg font-medium">{year}</span>
              <span className="text-sm text-muted">{count} 篇&nbsp; →</span>
            </div>
          )) : (
            <p className="py-3 text-sm text-muted">发布文章后将在这里形成时间线。</p>
          )}
        </div>
      </section>
    </aside>
  )
}
