// Adapted from React Bits ClickSpark-TS-TW: https://reactbits.dev/components/click-spark
// 保留“点击位置迸发粒子”的核心效果，改写为 hook + 纯 CSS 关键帧：
// 调用方把 spark 挂到交互元素的 onClick 上、把 particles 渲染进该元素内部，
// 不克隆子元素、不引入原版的形状库与额外依赖；
// 用户偏好减少动态效果时不迸发。
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { useReducedMotion } from 'motion/react'
import './ClickSpark.css'

interface Particle {
  id: number
  x: number
  y: number
  angle: number
  distance: number
  size: number
  duration: number
}

interface UseClickSparkOptions {
  color?: string
  particleCount?: number
  particleDistance?: number
  particleSize?: number
  /** 单个粒子从迸发到消失的最长时间，毫秒。 */
  duration?: number
}

/**
 * 点击迸发粒子。spark 需挂在交互元素的 onClick 上，
 * particles 渲染进同一个（定位）元素内部，二者配合完成一次迸发。
 */
export default function useClickSpark({
  color = 'var(--color-primary)',
  particleCount = 12,
  particleDistance = 44,
  particleSize = 5,
  duration = 560,
}: UseClickSparkOptions = {}) {
  const [particles, setParticles] = useState<Particle[]>([])
  const nextId = useRef(0)
  const timers = useRef<number[]>([])
  const reducedMotion = useReducedMotion()

  // 卸载后不再清理已迸发的粒子，避免对已卸载组件安排状态更新。
  useEffect(
    () => () => {
      timers.current.forEach((id) => window.clearTimeout(id))
      timers.current = []
    },
    [],
  )

  const spark = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (reducedMotion) return
      const rect = event.currentTarget.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      const fading = new Set<number>()
      const burst: Particle[] = Array.from({ length: particleCount }, () => {
        const id = nextId.current++
        fading.add(id)
        return {
          id,
          x,
          y,
          angle: Math.random() * 360,
          distance: Math.round(particleDistance * (0.6 + Math.random() * 0.4)),
          size: Math.round(particleSize * (0.7 + Math.random() * 0.6)),
          duration: Math.round(duration * (0.75 + Math.random() * 0.4)),
        }
      })
      setParticles((current) => [...current, ...burst])
      timers.current.push(
        window.setTimeout(() => {
          setParticles((current) => current.filter((particle) => !fading.has(particle.id)))
        }, duration),
      )
    },
    [duration, particleCount, particleDistance, particleSize, reducedMotion],
  )

  const layer: ReactNode =
    particles.length > 0 ? (
      <span className="click-spark__particles" aria-hidden="true">
        {particles.map((particle) => (
          <span
            key={particle.id}
            className="click-spark__particle"
            style={
              {
                '--spark-x': `${particle.x}px`,
                '--spark-y': `${particle.y}px`,
                '--spark-angle': `${particle.angle}deg`,
                '--spark-distance': `${particle.distance}px`,
                '--spark-size': `${particle.size}px`,
                '--spark-duration': `${particle.duration}ms`,
                '--spark-color': color,
              } as CSSProperties
            }
          />
        ))}
      </span>
    ) : null

  return { spark, particles: layer }
}
