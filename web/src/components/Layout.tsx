import { useEffect } from 'react'
import { Outlet } from 'react-router'
import { useAuthStore, useProfileStore } from '@/stores'
import Header from './Header'
import Footer from './Footer'

export default function Layout() {
  const initializeAuth = useAuthStore((state) => state.initialize)
  const initializeProfile = useProfileStore((state) => state.initialize)

  useEffect(() => {
    void initializeAuth()
    // 头像要在访客态的作者卡片里展示，进入站点时统一读取一次。
    void initializeProfile()
  }, [initializeAuth, initializeProfile])

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
