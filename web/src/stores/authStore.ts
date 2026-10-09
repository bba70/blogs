import { create } from 'zustand'
import * as api from '@/api'

interface AuthState {
  authenticated: boolean
  initialized: boolean
  loading: boolean
  error: string | null
  initialize: () => Promise<void>
  login: (password: string) => Promise<boolean>
  logout: () => Promise<void>
  expireSession: () => void
}

let initialization: Promise<void> | null = null

function loginErrorMessage(error: unknown) {
  if (api.isApiError(error)) {
    if (error.status === 429) return '尝试次数过多，请稍后再试。'
    if (error.status === 401) return '密码不正确，请重试。'
  }
  return '暂时无法登录，请稍后再试。'
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  authenticated: false,
  initialized: false,
  loading: false,
  error: null,

  initialize: async () => {
    if (get().initialized) return
    if (initialization) return initialization

    set({ loading: true, error: null })
    initialization = (async () => {
      try {
        const res = await api.fetchAuthStatus()
        set({ authenticated: res.data.authenticated, initialized: true, loading: false })
      } catch {
        set({ authenticated: false, initialized: true, loading: false })
      } finally {
        initialization = null
      }
    })()
    return initialization
  },

  login: async (password) => {
    set({ loading: true, error: null })
    try {
      const res = await api.login(password)
      set({ authenticated: res.data.authenticated, initialized: true, loading: false })
      return res.data.authenticated
    } catch (error) {
      set({ authenticated: false, initialized: true, loading: false, error: loginErrorMessage(error) })
      return false
    }
  },

  logout: async () => {
    set({ loading: true, error: null })
    try {
      await api.logout()
    } catch {
      // 即使服务暂时不可达，也清除前端作者态；服务端无状态会话会按固定期限过期。
    } finally {
      set({ authenticated: false, initialized: true, loading: false, error: null })
    }
  },

  expireSession: () => {
    set({ authenticated: false, initialized: true, loading: false, error: null })
  },
}))
