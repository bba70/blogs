import { Link } from 'react-router'

export default function Header() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
        <Link to="/" className="text-xl font-bold text-gray-900 hover:text-primary">
          Blog
        </Link>
        <nav className="flex items-center gap-4">
          <Link to="/" className="text-sm text-gray-600 hover:text-gray-900">
            首页
          </Link>
          <Link
            to="/editor"
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-white hover:bg-primary-dark"
          >
            写文章
          </Link>
        </nav>
      </div>
    </header>
  )
}
