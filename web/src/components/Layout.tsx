import { useEffect } from 'react'
import { Outlet } from 'react-router'
import { useAuthStore } from '@/stores'
import Header from './Header'
import Footer from './Footer'

export default function Layout() {
  const initializeAuth = useAuthStore((state) => state.initialize)

  useEffect(() => {
    void initializeAuth()
  }, [initializeAuth])

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
