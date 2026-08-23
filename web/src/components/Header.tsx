import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'

const navItems = [
  { label: '文章', hash: '#articles' },
  { label: '专题', hash: '#topics' },
  { label: '归档', hash: '#archive' },
  { label: '关于', hash: '#about' },
]

export default function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [searchOpen, setSearchOpen] = useState(Boolean(searchParams.get('q')))
  const [query, setQuery] = useState(searchParams.get('q') ?? '')

  function handleSearch(event: FormEvent) {
    event.preventDefault()
    const value = query.trim()
    navigate(value ? `/?q=${encodeURIComponent(value)}#articles` : '/#articles')
  }

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-white/95 backdrop-blur-sm">
      <div className="relative mx-auto flex h-[76px] max-w-[1440px] items-center gap-5 px-5 sm:px-8">
        <Link to="/" className="flex shrink-0 items-center gap-3" aria-label="昼白首页">
          <span className="site-mark" aria-hidden="true" />
          <span className="text-xl font-semibold tracking-[0.14em]">昼白</span>
        </Link>

        <nav className="mx-auto hidden items-center rounded-full border border-line bg-white p-1 md:flex" aria-label="主导航">
          {navItems.map((item) => {
            const active = location.pathname === '/' && (location.hash || '#articles') === item.hash
            return (
              <Link
                key={item.hash}
                to={`/${item.hash}`}
                className={`min-w-24 rounded-full px-5 py-2 text-center text-sm transition-colors ${
                  active ? 'bg-[#f3f4fb] font-medium text-primary' : 'text-muted hover:text-ink'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          {searchOpen && (
            <form onSubmit={handleSearch} className="absolute top-[68px] right-5 left-5 z-50 sm:static">
              <label className="sr-only" htmlFor="site-search">搜索文章</label>
              <input
                id="site-search"
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onBlur={() => !query && setSearchOpen(false)}
                className="h-11 w-full rounded-[10px] border border-line bg-white px-3 text-sm text-ink shadow-sm placeholder:text-muted focus:border-primary focus:outline-none sm:w-48 sm:shadow-none"
                placeholder="搜索文章"
              />
            </form>
          )}
          <button
            type="button"
            onClick={() => setSearchOpen((open) => !open)}
            className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-line bg-white text-muted transition-colors hover:border-[#cfcfcd] hover:text-ink"
            aria-label="搜索文章"
            aria-expanded={searchOpen}
          >
            <span className="search-icon" aria-hidden="true" />
          </button>
          <Link
            to="/editor"
            className="flex h-11 items-center gap-2 rounded-[10px] bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-dark sm:px-5"
          >
            <span className="text-xl font-light leading-none">＋</span>
            <span className="hidden sm:inline">新建文章</span>
          </Link>
        </div>
      </div>
      <nav className="flex overflow-x-auto border-t border-line px-4 md:hidden" aria-label="移动端导航">
        {navItems.map((item) => (
          <Link key={item.hash} to={`/${item.hash}`} className="min-w-20 px-4 py-3 text-center text-sm text-muted hover:text-primary">
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  )
}
