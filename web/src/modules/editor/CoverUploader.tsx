import { useEffect, useRef, useState } from 'react'
import { uploadImage } from '@/api/media'
import { isApiError } from '@/api/client'
import CoverCropDialog from './CoverCropDialog'

interface Props {
  value: string
  onChange: (url: string) => void
  onBusyChange: (busy: boolean) => void
}

export default function CoverUploader({ value, onChange, onBusyChange }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState<{ file: File; source: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const controller = useRef<AbortController | null>(null)

  useEffect(() => () => {
    controller.current?.abort()
    onBusyChange(false)
  }, [onBusyChange])

  useEffect(() => () => {
    if (pending) URL.revokeObjectURL(pending.source)
  }, [pending])

  function selectFile(file?: File) {
    if (!file || busy || pending) return
    setError('')
    if (file.size > 5 * 1024 * 1024) { setError('图片不能超过 5MB。'); return }
    if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) { setError('请选择 JPEG、PNG 或 GIF 图片。'); return }
    setPending({ file, source: URL.createObjectURL(file) })
    onBusyChange(true)
  }

  async function upload(file?: File) {
    if (!file || busy) return
    setError('')
    if (file.size > 5 * 1024 * 1024) { setError('图片不能超过 5MB。'); return }
    if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) { setError('请选择 JPEG、PNG 或 GIF 图片。'); return }
    const requestController = new AbortController()
    controller.current = requestController
    setBusy(true)
    onBusyChange(true)
    let completed = false
    try {
      const result = await uploadImage(file, requestController.signal)
      if (!requestController.signal.aborted) {
        onChange(result.data.url)
        setPending(null)
        completed = true
      }
    } catch (error) {
      if (!requestController.signal.aborted) setError(isApiError(error) && error.status === 401 ? '登录已过期，请重新登录后上传。' : '封面上传失败，请重新选择图片重试。')
    } finally {
      if (!requestController.signal.aborted) { setBusy(false); onBusyChange(!completed) }
    }
  }

  return (
    <div className="editor-cover" aria-busy={busy}>
      <button type="button" className={`editor-outline__cover${value ? '' : ' editor-cover--empty'}`} disabled={busy} aria-label={value ? '更换文章封面' : '上传文章封面'} onClick={() => inputRef.current?.click()}>
        {value ? <img src={value} alt="" className="editor-cover__preview" /> : <span className="editor-outline__cover-art" aria-hidden="true" />}
        {!value && <span className="editor-cover__invitation">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="1.5" /><path d="m3 17 5-5 4 4 4-6 5 7" /></svg>
          <span>{busy ? '正在上传封面…' : '上传一张图片作为封面'}</span>
          <span className="editor-cover__description">让读者第一眼了解你的文章</span>
        </span>}
        <span className="editor-cover__prompt">{busy ? '上传中…' : value ? '更换封面' : '上传封面'}</span>
      </button>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/gif" className="sr-only" aria-label="选择文章封面" disabled={busy} onChange={(event) => { selectFile(event.target.files?.[0]); event.target.value = '' }} />
      {value && <div className="editor-cover__actions"><button type="button" disabled={busy} onClick={() => { onChange(''); setError('') }}>移除封面</button></div>}
      <p className="editor-cover__hint">支持 JPEG / PNG / GIF，最大 5MB。选择图片后可裁剪，保存文章后生效。</p>
      {error && <p className="editor-cover__error" role="alert">{error}</p>}
      {pending && <CoverCropDialog file={pending.file} source={pending.source} busy={busy} error={error} onConfirm={upload} onCancel={() => { setPending(null); setError(''); onBusyChange(false) }} />}
    </div>
  )
}
