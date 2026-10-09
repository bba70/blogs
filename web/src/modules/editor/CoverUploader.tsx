import { useEffect, useRef, useState } from 'react'
import { uploadImage } from '@/api/media'
import { isApiError } from '@/api/client'

interface Props {
  value: string
  title: string
  status: string
  onChange: (url: string) => void
  onBusyChange: (busy: boolean) => void
}

export default function CoverUploader({ value, title, status, onChange, onBusyChange }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const controller = useRef<AbortController | null>(null)

  useEffect(() => () => {
    controller.current?.abort()
    onBusyChange(false)
  }, [onBusyChange])

  async function upload(file?: File) {
    if (!file || busy) return
    setError('')
    if (file.size > 5 * 1024 * 1024) { setError('图片不能超过 5MB。'); return }
    if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) { setError('请选择 JPEG、PNG 或 GIF 图片。'); return }
    const requestController = new AbortController()
    controller.current = requestController
    setBusy(true)
    onBusyChange(true)
    try {
      const result = await uploadImage(file, requestController.signal)
      if (!requestController.signal.aborted) onChange(result.data.url)
    } catch (error) {
      if (!requestController.signal.aborted) setError(isApiError(error) && error.status === 401 ? '登录已过期，请重新登录后上传。' : '封面上传失败，请重新选择图片重试。')
    } finally {
      if (!requestController.signal.aborted) { setBusy(false); onBusyChange(false) }
    }
  }

  return (
    <div className="editor-cover" aria-busy={busy}>
      <button type="button" className="editor-outline__cover" disabled={busy} aria-label={value ? '更换文章封面' : '上传文章封面'} onClick={() => inputRef.current?.click()}>
        {value ? <img src={value} alt="" className="editor-cover__preview" /> : <span className="editor-outline__cover-art" aria-hidden="true" />}
        <span className="editor-cover__prompt">{busy ? '上传中…' : value ? '更换封面' : '上传封面'}</span>
        <strong>{title || '未命名文章'}</strong>
        <small>{status === 'published' ? '已发布' : '草稿'}</small>
      </button>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/gif" className="sr-only" aria-label="选择文章封面" disabled={busy} onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = '' }} />
      {value && <div className="editor-cover__actions"><button type="button" disabled={busy} onClick={() => { onChange(''); setError('') }}>移除封面</button></div>}
      <p className="editor-cover__hint">JPEG / PNG / GIF，最大 5MB。保存文章后生效。</p>
      {error && <p className="editor-cover__error" role="alert">{error}</p>}
    </div>
  )
}
