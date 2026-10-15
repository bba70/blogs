import { useEffect, useId, useRef, useState, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { cropCover, cropRectangle, type CropPosition } from './coverCrop'
import './CoverCropDialog.css'

interface Props {
  file: File
  source: string
  busy: boolean
  error: string
  onConfirm: (file: File) => Promise<void>
  onCancel: () => void
}

const clamp = (value: number) => Math.max(-1, Math.min(1, value))

export default function CoverCropDialog({ file, source, busy, error, onConfirm, onCancel }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [frameWidth, setFrameWidth] = useState(0)
  const [ratioChoice, setRatioChoice] = useState('16:9')
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState<CropPosition>({ x: 0, y: 0 })
  const [exporting, setExporting] = useState(false)
  const [localError, setLocalError] = useState('')
  const drag = useRef<{ id: number; x: number; y: number; position: CropPosition } | null>(null)
  const titleId = useId()
  const descriptionId = useId()
  const working = busy || exporting
  const ratio = ratioChoice === '原始比例' ? (size.width / size.height || 1) : ratioChoice === '1:1' ? 1 : ratioChoice === '4:3' ? 4 / 3 : 16 / 9
  const crop = size.width ? cropRectangle(size.width, size.height, ratio, zoom, position) : null
  const scale = crop && frameWidth ? frameWidth / crop.width : 0
  const excessX = Math.max(0, (size.width * scale - frameWidth) / 2)
  const excessY = Math.max(0, (size.height * scale - frameWidth / ratio) / 2)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog.showModal()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
      previous?.focus()
    }
  }, [])

  function move(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current
    if (!start || start.id !== event.pointerId || working) return
    setPosition({
      x: excessX > 0 ? clamp(start.position.x + (event.clientX - start.x) / excessX) : 0,
      y: excessY > 0 ? clamp(start.position.y + (event.clientY - start.y) / excessY) : 0,
    })
  }

  async function confirm() {
    const image = imageRef.current
    if (!image || !size.width || working) return
    setExporting(true)
    setLocalError('')
    try {
      const result = await cropCover(image, file, ratio, zoom, position)
      await onConfirm(result)
    } catch (failure) {
      setLocalError(failure instanceof Error ? failure.message : '裁剪失败，请重试。')
    } finally {
      setExporting(false)
    }
  }

  return createPortal(
    <dialog ref={dialogRef} className="cover-crop" aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={(event) => { event.preventDefault(); if (!working) onCancel() }}>
      <div className="cover-crop__body" aria-busy={working}>
        <header><h2 id={titleId}>裁剪封面</h2><p id={descriptionId}>拖动图片调整取景，也可以使用下方滑块。</p></header>
        <div
          className="cover-crop__frame"
          style={{ aspectRatio: String(ratio), width: `min(100%, calc(48dvh * ${ratio}))` }}
          ref={(node) => {
            if (!node) return
            const observer = new ResizeObserver(([entry]) => setFrameWidth(entry.contentRect.width))
            observer.observe(node)
            return () => observer.disconnect()
          }}
          onPointerDown={(event) => {
            if (working || !size.width || event.button !== 0) return
            event.currentTarget.setPointerCapture(event.pointerId)
            drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, position }
          }}
          onPointerMove={move}
          onPointerUp={() => { drag.current = null }}
          onPointerCancel={() => { drag.current = null }}
        >
          <img ref={imageRef} src={source} alt="封面裁剪预览" draggable={false}
            style={{ width: size.width * scale, height: size.height * scale, left: `calc(50% + ${position.x * excessX}px)`, top: `calc(50% + ${position.y * excessY}px)`, opacity: scale ? 1 : 0 }}
            onLoad={(event) => setSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
            onError={() => { setSize({ width: 0, height: 0 }); setLocalError('无法读取这张图片，请取消后重新选择。') }} />
          <span className="cover-crop__grid" aria-hidden="true" />
          {!size.width && !localError && <span className="cover-crop__loading" role="status">正在读取图片…</span>}
        </div>
        <fieldset disabled={working || !size.width}>
          <legend>裁剪比例</legend>
          <div className="cover-crop__ratios">{['16:9', '4:3', '1:1', '原始比例'].map((choice) => (
            <button key={choice} type="button" aria-pressed={ratioChoice === choice} onClick={() => { setRatioChoice(choice); setZoom(1); setPosition({ x: 0, y: 0 }) }}>{choice}</button>
          ))}</div>
          <label htmlFor={`${titleId}-zoom`}>缩放 <output>{zoom.toFixed(1)}×</output><input id={`${titleId}-zoom`} type="range" min="1" max="3" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label>
          <div className="cover-crop__positions">
            <label>水平位置<input type="range" min="-100" max="100" step="1" value={Math.round(position.x * 100)} disabled={working || excessX < 1} onChange={(event) => setPosition({ ...position, x: Number(event.target.value) / 100 })} /></label>
            <label>垂直位置<input type="range" min="-100" max="100" step="1" value={Math.round(position.y * 100)} disabled={working || excessY < 1} onChange={(event) => setPosition({ ...position, y: Number(event.target.value) / 100 })} /></label>
          </div>
        </fieldset>
        {file.type === 'image/gif' && <p className="cover-crop__note">裁剪 GIF 会保存为静态图片；选择“使用原图”可保留动画。</p>}
        {(localError || error) && <p className="cover-crop__error" role="alert">{localError || error}</p>}
        <footer>
          <button type="button" disabled={working} onClick={onCancel}>取消</button>
          <button type="button" disabled={working || !size.width} onClick={() => void onConfirm(file)}>使用原图</button>
          <button type="button" className="cover-crop__confirm" disabled={working || !size.width} onClick={() => void confirm()}>{working ? '正在处理…' : '确认裁剪并上传'}</button>
        </footer>
      </div>
    </dialog>, document.body,
  )
}
