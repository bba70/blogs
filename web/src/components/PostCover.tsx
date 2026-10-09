import { useState, type ReactNode } from 'react'

export default function PostCover({ src, className, fallback }: { src?: string; className?: string; fallback?: ReactNode }) {
  const [failedSrc, setFailedSrc] = useState<string>()
  if (!src || failedSrc === src) return fallback ?? null
  return <img src={src} className={className} alt="" loading="lazy" decoding="async" onError={() => setFailedSrc(src)} />
}
