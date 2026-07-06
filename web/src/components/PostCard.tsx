import { Link } from 'react-router'
import type { Post } from '@/types'
import TagBadge from './TagBadge'
import StatusBadge from './StatusBadge'

export default function PostCard({ post }: { post: Post }) {
  return (
    <article className="rounded-lg border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md">
      <Link to={`/posts/${post.slug}`} className="block">
        <h2 className="text-lg font-semibold text-gray-900 hover:text-primary">{post.title}</h2>
      </Link>
      {post.summary && <p className="mt-2 text-sm text-gray-600 line-clamp-2">{post.summary}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusBadge status={post.status} />
        {post.tags.map((tag) => <TagBadge key={tag} name={tag} />)}
        <span className="ml-auto text-xs text-gray-400">
          {new Date(post.created_at).toLocaleDateString('zh-CN')}
        </span>
      </div>
    </article>
  )
}
