import type { PostStatus } from '@/types'

export default function StatusBadge({ status }: { status: PostStatus }) {
  const styles =
    status === 'published'
      ? 'bg-green-100 text-green-700'
      : 'bg-yellow-100 text-yellow-700'
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}>
      {status === 'published' ? '已发布' : '草稿'}
    </span>
  )
}
