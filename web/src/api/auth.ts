import type { AuthStatus } from '@/types'
import { request } from './client'

export function fetchAuthStatus() {
  return request<AuthStatus>('/auth/me')
}

export function login(password: string) {
  return request<AuthStatus>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  })
}

export function logout() {
  return request<AuthStatus>('/auth/logout', { method: 'POST' })
}
