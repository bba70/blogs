import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useAuthStore } from '@/stores'
import './LoginPage.css'

function safeNext(raw: string | null) {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/editor'

  try {
    const target = new URL(raw, window.location.origin)
    if (target.origin !== window.location.origin) return '/editor'
    if (target.pathname !== '/editor' && !target.pathname.startsWith('/editor/')) return '/editor'
    return `${target.pathname}${target.search}${target.hash}`
  } catch {
    return '/editor'
  }
}

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [password, setPassword] = useState('')
  const { authenticated, initialized, loading, error, initialize, login } = useAuthStore()
  const next = safeNext(searchParams.get('next'))

  useEffect(() => {
    void initialize()
  }, [initialize])

  useEffect(() => {
    if (initialized && authenticated) navigate(next, { replace: true })
  }, [authenticated, initialized, navigate, next])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!password || loading) return
    if (await login(password)) navigate(next, { replace: true })
  }

  return (
    <div className="owner-login-page">
      <div className="owner-login-page__glow" aria-hidden="true" />
      <section className="owner-login-card" aria-labelledby="owner-login-title">
        <div className="owner-login-card__mark" aria-hidden="true">
          {Array.from({ length: 9 }, (_, index) => <span key={index} />)}
        </div>
        <p className="owner-login-card__eyebrow">OWNER ACCESS</p>
        <h1 id="owner-login-title">作者验证</h1>
        <p className="owner-login-card__intro">输入作者密码后继续写作。这里不提供访客账号或注册入口。</p>

        <form onSubmit={handleSubmit} className="owner-login-form">
          <label htmlFor="owner-password">作者密码</label>
          <input
            id="owner-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            autoFocus
            required
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'owner-login-error' : undefined}
          />
          {error && <p id="owner-login-error" className="owner-login-form__error" role="alert">{error}</p>}
          <button type="submit" disabled={!password || loading}>
            {loading ? '正在验证…' : '进入编辑器'}
          </button>
        </form>

        <Link to="/blog" className="owner-login-card__back">
          <span aria-hidden="true">←</span> 返回博客
        </Link>
      </section>
    </div>
  )
}
