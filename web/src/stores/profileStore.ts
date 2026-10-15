import { create } from 'zustand'
import * as api from '@/api'
import { uploadImage } from '@/api/media'

// 与后端 media.MaxImageSize、封面校验保持一致。
const MAX_AVATAR_SIZE = 5 * 1024 * 1024
const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/gif']

interface ProfileState {
  avatarUrl: string
  initialized: boolean
  saving: boolean
  error: string | null
  initialize: () => Promise<void>
  saveAvatar: (file: File) => Promise<void>
  removeAvatar: () => Promise<void>
}

let initialization: Promise<void> | null = null

function saveErrorMessage(error: unknown) {
  if (api.isApiError(error) && error.status === 401) return '登录已过期，请重新登录后再试。'
  return '头像保存失败，请稍后重试。'
}

export const useProfileStore = create<ProfileState>()((set, get) => ({
  avatarUrl: '',
  initialized: false,
  saving: false,
  error: null,

  // 头像对所有访客展示，进入站点时读取一次；读取失败只保留占位图形。
  initialize: async () => {
    if (get().initialized) return
    if (initialization) return initialization

    initialization = (async () => {
      try {
        const res = await api.fetchProfile()
        set({ avatarUrl: res.data.avatar_url, initialized: true })
      } catch {
        set({ initialized: true })
      } finally {
        initialization = null
      }
    })()
    return initialization
  },

  // 先上传图片取得媒体地址，再写入作者资料；
  // 后端只接受媒体库地址，前端不把本地文件直接提交给资料接口。
  saveAvatar: async (file) => {
    if (get().saving) return
    if (file.size > MAX_AVATAR_SIZE) {
      set({ error: '头像图片不能超过 5MB。' })
      return
    }
    if (!AVATAR_TYPES.includes(file.type)) {
      set({ error: '请选择 JPEG、PNG 或 GIF 图片。' })
      return
    }

    set({ saving: true, error: null })
    try {
      const uploaded = await uploadImage(file)
      const res = await api.updateProfileAvatar(uploaded.data.url)
      set({ avatarUrl: res.data.avatar_url, saving: false })
    } catch (error) {
      set({ saving: false, error: saveErrorMessage(error) })
    }
  },

  removeAvatar: async () => {
    if (get().saving) return

    set({ saving: true, error: null })
    try {
      const res = await api.updateProfileAvatar('')
      set({ avatarUrl: res.data.avatar_url, saving: false })
    } catch (error) {
      set({ saving: false, error: saveErrorMessage(error) })
    }
  },
}))
