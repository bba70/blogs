import { request } from './client'
import type { Profile } from '@/types'

export async function fetchProfile() {
  return request<Profile>('/profile')
}

export async function updateProfileAvatar(avatarUrl: string) {
  return request<Profile>('/profile', {
    method: 'PUT',
    body: JSON.stringify({ avatar_url: avatarUrl }),
  })
}
