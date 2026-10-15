import { useRef, type PointerEvent, type ReactNode } from 'react'
import './SpotlightCard.css'

// Adapted from React Bits SpotlightCard; local pointer events, no idle animation loop.
// https://reactbits.dev/components/spotlight-card — see SpotlightCard.LICENSE.
export default function SpotlightCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  const lightRef = useRef<HTMLSpanElement>(null)
  function moveLight(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (lightRef.current) lightRef.current.style.transform = `translate(${event.clientX - rect.left - 160}px, ${event.clientY - rect.top - 160}px)`
  }
  return (
    <div className={`spotlight-card ${className}`} onPointerMove={moveLight}>
      <span ref={lightRef} className="spotlight-card__light" aria-hidden="true" />
      {children}
    </div>
  )
}
