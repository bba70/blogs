import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'

const navItems = [
  { label: '首页', hash: '#home' },
  { label: '博客', hash: '#articles' },
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
    <header className="sticky top-0 z-50 border-b border-black/[0.06] bg-white/90 backdrop-blur-xl">
      <div className="relative mx-auto flex h-[72px] max-w-[1600px] items-center gap-8 px-5 sm:px-8">
        <Link to="/" className="flex shrink-0 items-center gap-3" aria-label="昼白首页">
          <span className="brand-avatar" aria-hidden="true">昼</span>
          <span className="text-[17px] font-semibold tracking-[-0.02em]">昼白的博客</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="主导航">
          {navItems.map((item) => {
            const active = location.pathname === '/' && (location.hash || '#home') === item.hash
            return (
              <Link
                key={item.hash}
                to={`/${item.hash}`}
                className={`rounded-lg px-3.5 py-2 text-[15px] transition-colors ${
                  active ? 'font-medium text-ink' : 'text-[#55545a] hover:bg-black/[0.035] hover:text-ink'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <span
            className="hidden h-10 w-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-black/[0.04] sm:flex"
            title="GitHub 链接待配置"
            aria-label="GitHub 链接待配置"
          >
            <svg className="h-[22px] w-[22px]" aria-hidden="true"><use href="/icons.svg#github-icon" /></svg>
          </span>
          {searchOpen && (
            <form onSubmit={handleSearch} className="absolute top-[66px] right-5 left-5 z-50 sm:static">
              <label className="sr-only" htmlFor="site-search">搜索文章</label>
              <input
                id="site-search"
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onBlur={() => !query && setSearchOpen(false)}
                className="h-11 w-full rounded-full border border-transparent bg-[#f5f5f6] px-4 text-sm text-ink shadow-sm placeholder:text-muted focus:border-primary/40 focus:bg-white focus:outline-none sm:w-44 sm:shadow-none"
                placeholder="搜索…"
              />
            </form>
          )}
          <button
            type="button"
            onClick={() => setSearchOpen((open) => !open)}
            className={`flex h-11 items-center justify-center rounded-full bg-[#f5f5f6] text-muted transition-colors hover:text-ink ${searchOpen ? 'w-11 sm:hidden' : 'w-11 sm:w-[108px] sm:gap-3'}`}
            aria-label="搜索文章"
            aria-expanded={searchOpen}
          >
            <span className="search-icon" aria-hidden="true" />
            {!searchOpen && <span className="hidden text-sm sm:inline">搜索…</span>}
          </button>
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
