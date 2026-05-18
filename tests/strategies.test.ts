import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runHydrationStrategy } from '../lib/runtime/strategies'

function makeEl(): HTMLElement {
  return document.createElement('div')
}

describe('runHydrationStrategy', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('load — calls hydrate immediately', () => {
    const hydrate = vi.fn()
    runHydrationStrategy('load', makeEl(), hydrate)
    expect(hydrate).toHaveBeenCalledOnce()
  })

  it('never — never calls hydrate', () => {
    const hydrate = vi.fn()
    runHydrationStrategy('never', makeEl(), hydrate)
    expect(hydrate).not.toHaveBeenCalled()
  })

  it('manual — does not call hydrate automatically', () => {
    const hydrate = vi.fn()
    runHydrationStrategy('manual', makeEl(), hydrate)
    expect(hydrate).not.toHaveBeenCalled()
  })

  it('idle — calls hydrate via requestIdleCallback', () => {
    const hydrate = vi.fn()
    const ric = vi.fn((cb: () => void) => { cb(); return 0 })
    vi.stubGlobal('requestIdleCallback', ric)
    runHydrationStrategy('idle', makeEl(), hydrate)
    expect(ric).toHaveBeenCalledOnce()
    expect(hydrate).toHaveBeenCalledOnce()
  })

  it('idle — falls back to setTimeout when requestIdleCallback unavailable', () => {
    const hydrate = vi.fn()
    vi.stubGlobal('requestIdleCallback', undefined)
    vi.useFakeTimers()
    runHydrationStrategy('idle', makeEl(), hydrate)
    expect(hydrate).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(hydrate).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it('visible — calls hydrate when IntersectionObserver fires with isIntersecting', () => {
    const hydrate = vi.fn()
    let observerCallback: IntersectionObserverCallback = () => {}
    const disconnect = vi.fn()
    const observe = vi.fn()

    vi.stubGlobal('IntersectionObserver', class {
      constructor(cb: IntersectionObserverCallback) { observerCallback = cb }
      observe = observe
      disconnect = disconnect
    })

    const el = makeEl()
    runHydrationStrategy('visible', el, hydrate)
    expect(hydrate).not.toHaveBeenCalled()

    // simulate element becoming visible
    observerCallback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
    expect(disconnect).toHaveBeenCalledOnce()
    expect(hydrate).toHaveBeenCalledOnce()
  })

  it('visible — does not hydrate when isIntersecting is false', () => {
    const hydrate = vi.fn()
    let observerCallback: IntersectionObserverCallback = () => {}
    vi.stubGlobal('IntersectionObserver', class {
      constructor(cb: IntersectionObserverCallback) { observerCallback = cb }
      observe = vi.fn()
      disconnect = vi.fn()
    })

    runHydrationStrategy('visible', makeEl(), hydrate)
    observerCallback([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver)
    expect(hydrate).not.toHaveBeenCalled()
  })

  it('interaction — hydrates on click', () => {
    const hydrate = vi.fn()
    const el = makeEl()
    runHydrationStrategy('interaction', el, hydrate)
    expect(hydrate).not.toHaveBeenCalled()
    el.dispatchEvent(new Event('click'))
    expect(hydrate).toHaveBeenCalledOnce()
  })

  it('interaction — hydrates only once even if multiple events fire', () => {
    const hydrate = vi.fn()
    const el = makeEl()
    runHydrationStrategy('interaction', el, hydrate)
    el.dispatchEvent(new Event('click'))
    el.dispatchEvent(new Event('focusin'))
    el.dispatchEvent(new Event('pointerenter'))
    expect(hydrate).toHaveBeenCalledOnce()
  })

  it('interaction — hydrates on focusin', () => {
    const hydrate = vi.fn()
    const el = makeEl()
    runHydrationStrategy('interaction', el, hydrate)
    el.dispatchEvent(new Event('focusin'))
    expect(hydrate).toHaveBeenCalledOnce()
  })
})
