import { useRef, type ReactNode } from 'react'
import { AnimatePresence, LazyMotion, useReducedMotion } from 'motion/react'
import * as motion from 'motion/react-m'
import { useAuthStore, useProfileStore } from '@/stores'
import { Camera, X } from '@/components/blogIcons'
import useClickSpark from '@/components/effects/useClickSpark'
import './AuthorAvatar.css'

// 复用 Header 的异步 motion 特性包；嵌套的 LazyMotion 共享同一个动态导入。
const loadMotionFeatures = () => import('@/components/headerMotionFeatures').then((module) => module.default)

interface AuthorAvatarProps {
  /** 圆形头像容器的类名；尺寸、边框和背景由调用方的卡片决定。 */
  className?: string
  /**
   * 是否在该位置提供作者专用的更换头像入口。
   * 访客始终看不到入口，服务端也只允许作者写入头像。
   */
  editable?: boolean
  /** 叠加在头像上的装饰元素，例如博客侧栏的作者徽章。 */
  children?: ReactNode
}

/**
 * 作者头像。头像地址由 profile store 统一持有，
 * 因此首页、文章列表侧栏和文章页展示的是同一张头像。
 *
 * 作者态下头像本体即修改入口：悬停或键盘聚焦浮现相机提示层，
 * 点击后粒子迸发并打开选择器；保存成功以轻微弹入确认新头像。
 */
export default function AuthorAvatar({ className, editable = true, children }: AuthorAvatarProps) {
  const avatarUrl = useProfileStore((state) => state.avatarUrl)
  const saving = useProfileStore((state) => state.saving)
  const error = useProfileStore((state) => state.error)
  const saveAvatar = useProfileStore((state) => state.saveAvatar)
  const removeAvatar = useProfileStore((state) => state.removeAvatar)
  const authenticated = useAuthStore((state) => state.authenticated)
  const inputRef = useRef<HTMLInputElement>(null)
  const reducedMotion = useReducedMotion()
  const { spark, particles } = useClickSpark({ particleCount: 14, particleDistance: 44 })
  const canEdit = editable && authenticated
  const hint = saving ? '正在保存…' : avatarUrl ? '更换头像' : '上传头像'

  // 头像内容独立一层：地址变化时按 key 重挂载，以弹入动画确认结果。
  const figure = (
    <motion.span
      key={avatarUrl}
      className="author-avatar__figure"
      initial={reducedMotion ? false : { opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 420, damping: 26 } }}
    >
      {avatarUrl ? <img className="author-avatar__image" src={avatarUrl} alt="" /> : <span className="profile-mark" />}
    </motion.span>
  )

  return (
    <LazyMotion features={loadMotionFeatures} strict>
      {canEdit ? (
        <>
          <motion.button
            type="button"
            className={`author-avatar author-avatar--editable${className ? ` ${className}` : ''}`}
            aria-label={saving ? '正在保存头像' : hint}
            aria-busy={saving}
            disabled={saving}
            whileHover={reducedMotion ? undefined : { scale: 1.03 }}
            whileTap={reducedMotion ? undefined : { scale: 0.97 }}
            onClick={(event) => {
              spark(event)
              inputRef.current?.click()
            }}
          >
            {figure}
            {children}
            <span className="author-avatar__overlay" aria-hidden="true">
              {saving ? <span className="author-avatar__spinner" /> : <Camera size={22} aria-hidden="true" />}
              <span className="author-avatar__hint">{hint}</span>
            </span>
            {particles}
          </motion.button>
          <AnimatePresence initial={false}>
            {avatarUrl ? (
              <motion.button
                key="remove"
                type="button"
                className="author-avatar__remove"
                disabled={saving}
                onClick={() => void removeAvatar()}
                initial={reducedMotion ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.18 } }}
                exit={{ opacity: 0, y: 4, transition: { duration: 0.12 } }}
              >
                <X size={13} aria-hidden="true" />
                移除头像
              </motion.button>
            ) : null}
          </AnimatePresence>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif"
            className="sr-only"
            aria-label="选择头像图片"
            disabled={saving}
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) void saveAvatar(file)
            }}
          />
        </>
      ) : (
        <div className={`author-avatar${className ? ` ${className}` : ''}`} aria-hidden="true">
          {figure}
          {children}
        </div>
      )}
      <AnimatePresence initial={false}>
        {canEdit && error ? (
          <motion.p
            key="error"
            className="author-avatar__error"
            role="alert"
            initial={reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.2 } }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
          >
            {error}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </LazyMotion>
  )
}
