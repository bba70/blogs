import { useCallback } from 'react'

// Keep content visible when animation or observation is unavailable.
export default function useArticleReveal(delay = 0) {
  return useCallback((node: HTMLElement | null) => {
    if (!node || !('IntersectionObserver' in window) || !node.animate) return

    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (preference.matches) return

    let animation: Animation | undefined
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      observer.disconnect()
      animation = node.animate(
        [{ opacity: 0, translate: '0 12px' }, { opacity: 1, translate: '0 0' }],
        { duration: 420, delay: Math.min(delay, 180), easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'backwards' },
      )
    }, { threshold: 0.08 })

    function stopMotion() {
      if (preference.matches) {
        observer.disconnect()
        animation?.cancel()
      }
    }

    observer.observe(node)
    preference.addEventListener('change', stopMotion)
    return () => {
      observer.disconnect()
      animation?.cancel()
      preference.removeEventListener('change', stopMotion)
    }
  }, [delay])
}
