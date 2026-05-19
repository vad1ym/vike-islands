import { describe, it, expect, beforeEach } from 'vitest'
import { createSSRApp, defineComponent, h, Suspense } from 'vue'
import { renderToString } from 'vue/server-renderer'

// Minimal in-memory cache adapter
function createMemoryCache() {
  const store = new Map<string, string>()
  return {
    async get(key: string) { return store.get(key) ?? null },
    async set(key: string, html: string) { store.set(key, html) },
    clear() { store.clear() },
    size() { return store.size },
  }
}

// Simulate a heavy component — large data iteration like ListBody
function makeHeavyComponent(itemCount: number) {
  const items = Array.from({ length: itemCount }, (_, i) => ({
    slug: `medicine-${i}`,
    brandName: `Brand ${String.fromCharCode(65 + (i % 26))} ${i}`,
    manufacturer: `Pharma ${i % 50}`,
    ingredient: `Ingredient ${i % 100}`,
  }))

  return defineComponent({
    props: { country: String },
    setup(props) {
      // Heavy: group by first letter (like ListBody.groupedItems)
      const groups = new Map<string, typeof items>()
      for (const item of items) {
        const key = item.brandName[0]?.toUpperCase() || '#'
        const bucket = groups.get(key)
        if (bucket) bucket.push(item)
        else groups.set(key, [item])
      }
      const grouped = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
      return () => h('div', grouped.map(([char, group]) =>
        h('div', [
          h('h2', char),
          ...group.map(item => h('div', { key: item.slug }, [
            h('span', item.brandName),
            h('span', item.manufacturer),
          ]))
        ])
      ))
    },
  })
}

async function renderWithCache(
  component: ReturnType<typeof makeHeavyComponent>,
  props: Record<string, unknown>,
  cache: ReturnType<typeof createMemoryCache>,
  cacheKey: string,
): Promise<{ html: string; fromCache: boolean }> {
  const cached = await cache.get(cacheKey)
  if (cached !== null) return { html: cached, fromCache: true }

  const app = createSSRApp(defineComponent({
    setup: () => () => h(Suspense, null, { default: () => h(component, props) }),
  }))
  const html = await renderToString(app)
  await cache.set(cacheKey, html)
  return { html, fromCache: false }
}

function measure(label: string, fn: () => Promise<void>): Promise<number> {
  const start = performance.now()
  return fn().then(() => {
    const ms = performance.now() - start
    console.log(`  ${label}: ${ms.toFixed(2)}ms`)
    return ms
  })
}

describe('island SSR cache performance', () => {
  const cache = createMemoryCache()
  const ITEM_COUNT = 2000
  const component = makeHeavyComponent(ITEM_COUNT)
  const props = { country: 'spain' }
  const cacheKey = 'ListBody:spain'

  beforeEach(() => cache.clear())

  it('cache miss renders and stores HTML', async () => {
    const { fromCache, html } = await renderWithCache(component, props, cache, cacheKey)
    expect(fromCache).toBe(false)
    expect(html.length).toBeGreaterThan(100)
    expect(cache.size()).toBe(1)
  })

  it('cache hit returns same HTML without re-rendering', async () => {
    // warm up
    const { html: original } = await renderWithCache(component, props, cache, cacheKey)
    // cache hit
    const { html: cached, fromCache } = await renderWithCache(component, props, cache, cacheKey)
    expect(fromCache).toBe(true)
    expect(cached).toBe(original)
  })

  it('cache hit is significantly faster than miss', async () => {
    const RUNS = 10

    const missTime = await measure(`${RUNS}x cache miss (${ITEM_COUNT} items each)`, async () => {
      for (let i = 0; i < RUNS; i++) {
        cache.clear()
        await renderWithCache(component, props, cache, cacheKey)
      }
    })

    // warm cache
    cache.clear()
    await renderWithCache(component, props, cache, cacheKey)

    const hitTime = await measure(`${RUNS}x cache hit`, async () => {
      for (let i = 0; i < RUNS; i++) {
        await renderWithCache(component, props, cache, cacheKey)
      }
    })

    const speedup = missTime / hitTime
    console.log(`  speedup: ${speedup.toFixed(1)}x`)
    // cache hit should be at least 5x faster
    expect(speedup).toBeGreaterThan(5)
  })

  it('JSON.stringify of large props is measurable overhead', async () => {
    const largeProps = {
      data: {
        items: Array.from({ length: ITEM_COUNT }, (_, i) => ({
          slug: `medicine-${i}`,
          brandName: `Brand ${i}`,
          manufacturer: `Pharma ${i}`,
          price: Math.random() * 100,
          description: `Description for medicine ${i} with some longer text`,
        })),
        country: 'spain',
        view: 'list',
      }
    }

    const serializeTime = await measure('JSON.stringify large props (cache key)', async () => {
      for (let i = 0; i < 100; i++) {
        JSON.stringify(largeProps)
      }
    })

    const noSerializeTime = await measure('cache hit (no stringify)', async () => {
      cache.clear()
      await renderWithCache(component, props, cache, 'small-key')
      for (let i = 0; i < 100; i++) {
        await renderWithCache(component, props, cache, 'small-key')
      }
    })

    console.log(`  stringify overhead per req: ${(serializeTime / 100).toFixed(2)}ms`)
    console.log(`  cache hit per req: ${(noSerializeTime / 100).toFixed(2)}ms`)
  })
})
