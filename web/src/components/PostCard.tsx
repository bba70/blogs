import { Link } from 'react-router'
import type { Post } from '@/types'
import TagBadge from './TagBadge'
import StatusBadge from './StatusBadge'
import PostCover from './PostCover'
import useArticleReveal from '@/hooks/useArticleReveal'

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

export default function PostCard({ post, index = 0 }: { post: Post; index?: number }) {
  const revealRef = useArticleReveal(index * 45)
  const artTypes = ['cube', 'wave', 'radial']
  const artType = artTypes[Math.abs(post.id) % artTypes.length]

  return (
    <article ref={revealRef} className="article-card group flex min-h-[116px] rounded-[14px] border border-line bg-white">
      <PostCover src={post.cover_url} className="article-art post-card-cover ml-4 self-center rounded-lg" fallback={<div className={`article-art article-art-${artType} ml-4 self-center rounded-lg`} aria-hidden="true" />} />
      <div className="flex min-w-0 flex-1 flex-col gap-3 px-5 py-5 lg:flex-row lg:items-center lg:gap-8 lg:px-7">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-2 text-xs font-medium text-primary">
            <span>{post.tags[0] ?? '随笔'}</span>
            {post.status === 'draft' && <StatusBadge status={post.status} />}
          </div>
          <Link to={`/posts/${post.slug}`} className="block">
            <h2 className="truncate text-lg font-semibold tracking-tight text-ink transition-colors group-hover:text-primary sm:text-xl">
              {post.title}
            </h2>
          </Link>
          {post.summary && <p className="mt-1 line-clamp-1 text-sm leading-6 text-muted">{post.summary}</p>}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3 text-xs text-muted lg:w-[240px] lg:justify-end">
          <time>{formatDate(post.published_at ?? post.created_at)}</time>
          <span aria-hidden="true">·</span>
          <span>{readingMinutes(post.content)} 分钟</span>
          <div className="flex w-full flex-wrap gap-1.5 lg:justify-end">
            {post.tags.slice(0, 3).map((tag) => <TagBadge key={tag} name={tag} />)}
          </div>
        </div>
      </div>
    </article>
  )
}
