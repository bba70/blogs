import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { AnimatePresence, LayoutGroup, LazyMotion, useIsPresent, useReducedMotion } from 'motion/react'
import * as motion from 'motion/react-m'
import { useAuthStore } from '@/stores'

const navItems = [
  { label: '文章', to: '/blog', section: 'articles' },
  { label: '专题', to: '/#topics', section: 'topics' },
  { label: '归档', to: '/archive', section: 'archive' },
  { label: '关于', to: '/#about', section: 'about' },
]

const loadMotionFeatures = () => import('./headerMotionFeatures').then((module) => module.default)

function SearchPanel({ children, onSubmit }: { children: ReactNode; onSubmit: (event: FormEvent) => void }) {
  const present = useIsPresent()
  const reducedMotion = useReducedMotion()

  return (
    <motion.form
      onSubmit={onSubmit}
      className="site-search"
      role="search"
      inert={!present}
      aria-hidden={!present}
      initial={{ opacity: 0, y: reducedMotion ? 0 : -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reducedMotion ? 0 : -4 }}
      transition={{ duration: reducedMotion ? 0 : 0.18 }}
    >
      {children}
    </motion.form>
  )
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

export default function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [searchOpen, setSearchOpen] = useState(Boolean(searchParams.get('q')))
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [activeHash, setActiveHash] = useState(location.hash || '#home')
  const [previewNav, setPreviewNav] = useState<string | null>(null)
  const reducedMotion = useReducedMotion()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchButtonRef = useRef<HTMLButtonElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const { authenticated, logout } = useAuthStore()

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (document.activeElement?.closest('.site-search')) searchButtonRef.current?.focus()
        if (document.activeElement?.closest('.mobile-navigation')) menuButtonRef.current?.focus()
        setSearchOpen(false)
        setMenuOpen(false)
      }

      if (event.key === '/' && !isEditableTarget(event.target)) {
        event.preventDefault()
        setMenuOpen(false)
        setSearchOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (location.pathname !== '/') return

    const sections = ['home', ...navItems.map((item) => item.section)]
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => Boolean(section))

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible) setActiveHash(`#${visible.target.id}`)
      },
      { rootMargin: '-18% 0px -62% 0px', threshold: [0, 0.1, 0.5] },
    )

    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [location.pathname])

  function handleSearch(event: FormEvent) {
    event.preventDefault()
    const value = query.trim()
    setSearchOpen(false)
    setActiveHash('#articles')
    navigate(value ? `/blog?q=${encodeURIComponent(value)}` : '/blog')
  }

  async function handleLogout() {
    await logout()
    setMenuOpen(false)
    setSearchOpen(false)
    navigate('/')
  }

  function isNavItemActive(item: (typeof navItems)[number]) {
    if (item.to === '/archive') return location.pathname === '/archive'
    if (item.to === '/blog') {
      return location.pathname === '/blog'
        || location.pathname.startsWith('/posts/')
        || (location.pathname === '/' && activeHash === '#articles')
    }

    return location.pathname === '/' && activeHash === `#${item.section}`
  }

  const searchPanel = searchOpen && (
    <SearchPanel key="search" onSubmit={handleSearch}>
      <label className="sr-only" htmlFor="site-search">搜索文章</label>
      <span className="search-icon" aria-hidden="true" />
      <input
        id="site-search"
        ref={searchInputRef}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="site-search__input"
        placeholder="搜索文章…"
        autoComplete="off"
      />
      <kbd className="site-search__hint" aria-hidden="true">ESC</kbd>
    </SearchPanel>
  )

  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <header className="site-header">
        <div className="site-header__rules" aria-hidden="true" />
        <div className="site-header__inner">
          <Link
            to="/#home"
            className="site-brand"
            aria-label="逃跑计划首页"
            title="返回主页"
            onClick={(event) => {
              setActiveHash('#home')
              setMenuOpen(false)
              setSearchOpen(false)

              if (location.pathname === '/') {
                event.preventDefault()
                if (location.search || location.hash !== '#home') navigate('/#home')
                document.getElementById('home')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            }}
          >
            <span className="site-brand__name">逃跑计划</span>
          </Link>

          <LayoutGroup id="header-navigation">
            <nav
              className="site-nav"
              aria-label="主导航"
              onMouseLeave={() => setPreviewNav(null)}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setPreviewNav(null)
              }}
            >
              {navItems.map((item) => {
                const active = isNavItemActive(item)
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="site-nav__link"
                    aria-current={active ? 'location' : undefined}
                    onMouseEnter={() => setPreviewNav(item.to)}
                    onFocus={() => setPreviewNav(item.to)}
                    onClick={() => {
                      setActiveHash(`#${item.section}`)
                      setSearchOpen(false)
                    }}
                  >
                    {item.label}
                    {(previewNav ? previewNav === item.to : active) && (
                      <motion.span
                        className="site-nav__indicator"
                        aria-hidden="true"
                        layoutId={reducedMotion ? undefined : 'nav-indicator'}
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      />
                    )}
                  </Link>
                )
              })}
            </nav>
          </LayoutGroup>

          <div className="site-header__actions">
            {authenticated && (
              <div className="site-header__owner-actions" aria-label="作者操作">
                <Link to="/editor" onClick={() => setMenuOpen(false)}>写作</Link>
                <button type="button" onClick={() => void handleLogout()}>退出</button>
              </div>
            )}
            <button
              ref={searchButtonRef}
              type="button"
              onClick={() => {
                setMenuOpen(false)
                setSearchOpen((open) => !open)
              }}
              className="site-header__icon-button"
              aria-label={searchOpen ? '关闭搜索' : '搜索文章，快捷键斜杠'}
              aria-expanded={searchOpen}
            >
              <span className="search-icon" aria-hidden="true" />
            </button>
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => {
                setSearchOpen(false)
                setMenuOpen((open) => !open)
              }}
              className="site-header__menu-button"
              aria-label={menuOpen ? '关闭导航菜单' : '打开导航菜单'}
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
            >
              <span aria-hidden="true" />
              <span aria-hidden="true" />
            </button>
          </div>

          <AnimatePresence initial={false}>{searchPanel}</AnimatePresence>
        </div>

        <motion.nav
          id="mobile-navigation"
          className={`mobile-navigation ${menuOpen ? 'mobile-navigation--open' : ''}`}
          aria-label="移动端导航"
          aria-hidden={!menuOpen}
          inert={!menuOpen}
          initial={false}
          animate={{ opacity: menuOpen ? 1 : 0, y: reducedMotion || menuOpen ? 0 : -8 }}
          transition={{ duration: reducedMotion ? 0 : 0.2 }}
        >
          {navItems.map((item, index) => (
            <Link
              key={item.to}
              to={item.to}
              className="mobile-navigation__link"
              aria-current={isNavItemActive(item) ? 'location' : undefined}
              onClick={() => {
                setActiveHash(`#${item.section}`)
                setMenuOpen(false)
              }}
            >
              <span className="mobile-navigation__index" aria-hidden="true">0{index + 1}</span>
              {item.label}
              <span aria-hidden="true">↗</span>
            </Link>
          ))}
          {authenticated && (
            <>
              <Link
                to="/editor"
                className="mobile-navigation__link mobile-navigation__owner-link"
                onClick={() => setMenuOpen(false)}
              >
                <span className="mobile-navigation__index" aria-hidden="true">作者</span>
                新建文章
                <span aria-hidden="true">＋</span>
              </Link>
              <button
                type="button"
                className="mobile-navigation__link mobile-navigation__owner-link"
                onClick={() => void handleLogout()}
              >
                <span className="mobile-navigation__index" aria-hidden="true">会话</span>
                退出登录
                <span aria-hidden="true">←</span>
              </button>
            </>
          )}
        </motion.nav>
      </header>
    </LazyMotion>
  )
}
