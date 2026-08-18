import type { PostStatus } from '@/types'

export default function StatusBadge({ status }: { status: PostStatus }) {
  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-lg border px-2.5 py-1 text-xs font-medium ${
        status === 'published'
          ? 'border-[#dfe7df] bg-[#f6faf6] text-[#4f6b53]'
          : 'border-[#eee4cd] bg-[#fffaf0] text-[#8a6a31]'
      }`}
    >
      {status === 'published' ? '已发布' : '草稿'}
    </span>
  )
}
