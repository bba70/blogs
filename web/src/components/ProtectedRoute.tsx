import { useEffect, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuthStore } from '@/stores'
import LoadingSpinner from './LoadingSpinner'

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { authenticated, initialized, initialize } = useAuthStore()

  useEffect(() => {
    void initialize()
  }, [initialize])

  if (!initialized) return <LoadingSpinner />

  if (!authenticated) {
    const next = `${location.pathname}${location.search}${location.hash}`
    return <Navigate replace to={`/login?next=${encodeURIComponent(next)}`} />
  }

  return children
}
