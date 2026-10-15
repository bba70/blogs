import { useReducedMotion, type Variants } from 'motion/react'
import * as motion from 'motion/react-m'

// Adapted from React Bits BlurText-TS-TW: https://reactbits.dev/text-animations/blur-text
// Keep the word/letter sequencing, with readable defaults and compositor-only motion.
const reveal: Variants = {
  static: { opacity: 1, transform: 'none' },
  visible: (index: number) => ({
    opacity: [0.35, 1],
    transform: ['translateY(8px)', 'translateY(0px)'],
    transition: { duration: 0.45, delay: index * 0.04, ease: [0.23, 1, 0.32, 1] },
  }),
}

export default function RevealText({ text }: { text: string }) {
  const reducedMotion = useReducedMotion()

  let characterIndex = 0
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {text.split(' ').map((word, wordIndex) => (
          <span key={wordIndex} className="inline-block whitespace-nowrap">
            {wordIndex > 0 && '\u00a0'}
            {Array.from(word).map((letter, index) => (
              <motion.span key={index} className="inline-block" custom={characterIndex++} initial="static" animate={reducedMotion ? 'static' : 'visible'} variants={reveal}>
                {letter}
              </motion.span>
            ))}
          </span>
        ))}
      </span>
    </>
  )
}
