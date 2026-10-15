import { Link } from 'react-router'
import { Hash } from './blogIcons'

export default function TagBadge({ name, active }: { name: string; active?: boolean }) {
  return (
    <Link
      to={`/topics?tag=${encodeURIComponent(name)}`}
      className={`inline-flex min-h-7 items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors [@media(pointer:coarse)]:min-h-11 ${
        active
          ? 'border-primary bg-primary text-white'
          : 'border-line bg-white text-muted hover:border-[#c9c9c7] hover:text-ink'
      }`}
    >
      <Hash size={12} className="shrink-0" aria-hidden="true" />{name}
    </Link>
  )
}
