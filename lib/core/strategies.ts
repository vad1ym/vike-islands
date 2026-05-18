import type { HydrateMode } from './types'

type HydrateFn = () => void

export function runHydrationStrategy(mode: HydrateMode, el: HTMLElement, hydrate: HydrateFn): void {
  switch (mode) {
    case 'load':
      hydrate()
      break

    case 'idle':
      if ('requestIdleCallback' in window) {
        ;(window as any).requestIdleCallback(() => hydrate())
      } else {
        setTimeout(hydrate, 1)
      }
      break

    case 'visible': {
      const observer = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting) {
          observer.disconnect()
          hydrate()
        }
      })
      observer.observe(el)
      break
    }

    case 'interaction': {
      const events = ['click', 'focusin', 'pointerenter'] as const
      const handler = () => {
        for (const e of events) el.removeEventListener(e, handler)
        hydrate()
      }
      for (const e of events) {
        el.addEventListener(e, handler, { once: true, passive: true })
      }
      break
    }

    case 'manual':
      break

    case 'never':
      break
  }
}
