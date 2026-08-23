import { Link } from 'react-router'

export default function TagBadge({ name, active }: { name: string; active?: boolean }) {
  return (
    <Link
      to={`/?tag=${encodeURIComponent(name)}#articles`}
      className={`inline-flex min-h-7 items-center rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? 'border-primary bg-primary text-white'
          : 'border-line bg-white text-muted hover:border-[#c9c9c7] hover:text-ink'
      }`}
    >
      {name}
    </Link>
  )
}
