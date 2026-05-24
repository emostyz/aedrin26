'use client'

import { motion, AnimatePresence, type Variants } from 'motion/react'

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] } },
  exit:   { opacity: 0, y: -8, transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] } },
}

const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { duration: 0.35, ease: 'easeOut' } },
  exit:   { opacity: 0, transition: { duration: 0.2 } },
}

const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
}

const slideLeft: Variants = {
  hidden: { opacity: 0, x: 24 },
  show:   { opacity: 1, x: 0, transition: { duration: 0.38, ease: [0.25, 0.1, 0.25, 1] } },
  exit:   { opacity: 0, x: -24, transition: { duration: 0.25 } },
}

export function FadeUp({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      exit="exit"
      transition={{ delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function FadeIn({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      variants={fadeIn}
      initial="hidden"
      animate="show"
      exit="exit"
      transition={{ delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function Stagger({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div variants={fadeUp} className={className}>
      {children}
    </motion.div>
  )
}

export function SlideQuestion({
  children,
  direction,
  id,
}: {
  children: React.ReactNode
  direction: 'forward' | 'back'
  id: string | number
}) {
  const variants: Variants = {
    enter: { opacity: 0, x: direction === 'forward' ? 32 : -32 },
    center: { opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] } },
    exit: { opacity: 0, x: direction === 'forward' ? -32 : 32, transition: { duration: 0.2 } },
  }
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={id}
        variants={variants}
        initial="enter"
        animate="center"
        exit="exit"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

export function ScaleOnHover({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.15 }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export { motion, AnimatePresence }
