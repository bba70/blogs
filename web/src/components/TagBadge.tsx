import { Link } from 'react-router'

export default function TagBadge({ name, active }: { name: string; active?: boolean }) {
  return (
    <Link
      to={`/?tag=${encodeURIComponent(name)}`}
      className={`inline-block rounded-full px-3 py-0.5 text-xs font-medium transition-colors ${
        active
          ? 'bg-primary text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {name}
    </Link>
  )
}
