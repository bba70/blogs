import { useEffect, useRef, type RefObject } from 'react'
import './ReadingProgress.css'

export default function ReadingProgress({ contentRef }: { contentRef: RefObject<HTMLDivElement | null> }) {
  const progressRef = useRef<HTMLDivElement>(null)
  const fillRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const content = contentRef.current
    const progress = progressRef.current
    const fill = fillRef.current
    if (!content || !progress || !fill) return

    let frame = 0
    function update() {
      frame = 0
      if (!content || !progress || !fill) return
      const bounds = content.getBoundingClientRect()
      const headerHeight = document.querySelector('.site-header')?.getBoundingClientRect().height ?? 0
      const viewportHeight = window.innerHeight - headerHeight
      const distance = bounds.height - viewportHeight
      // Short articles are complete once the whole body is visible below the header.
      const ratio = distance > 0
        ? Math.max(0, Math.min(1, (headerHeight - bounds.top) / distance))
        : bounds.bottom <= window.innerHeight ? 1 : 0
      fill.style.transform = `scaleX(${ratio})`
      progress.setAttribute('aria-valuenow', String(Math.round(ratio * 100)))
    }

    function scheduleUpdate() {
      if (!frame) frame = window.requestAnimationFrame(update)
    }

    const observer = new ResizeObserver(scheduleUpdate)
    observer.observe(content)
    const header = document.querySelector('.site-header')
    if (header) observer.observe(header)
    window.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate)
    update()

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
      window.cancelAnimationFrame(frame)
    }
  }, [contentRef])

  return (
    <div ref={progressRef} className="reading-progress" role="progressbar" aria-label="文章阅读进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0}>
      <div ref={fillRef} className="reading-progress__fill" />
    </div>
  )
}
