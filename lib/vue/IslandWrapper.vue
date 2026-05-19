<script lang="ts">
import { defineComponent, h, getCurrentInstance, createSSRApp } from 'vue'
import { makeCacheKey } from '../core/cache'
import type { IslandCacheAdapter } from '../core/cache'
import type { Component } from 'vue'

const GLOBAL_CACHE_KEY = '__vikeIslandsCacheAdapter__'
const isServer = typeof window === 'undefined'

function getCacheAdapter(): IslandCacheAdapter | null {
  return (globalThis as any)[GLOBAL_CACHE_KEY] ?? null
}

export default defineComponent({
  name: 'IslandWrapper',

  inheritAttrs: false,

  props: {
    islandName: { type: String, required: true },
    islandId: { type: String, required: true },
    dataHydrate: { type: String, required: true },
    islandComponent: { type: Object as () => Component, default: undefined },
    cacheTtl: { type: Number, default: undefined },
    cacheKey: { type: String, default: undefined },
  },

  async setup(props, { attrs }) {
    const renderNormal = () => h('div', {
      'data-island': props.islandName,
      'data-island-id': props.islandId,
      'data-hydrate': props.dataHydrate,
      'data-island-props': JSON.stringify(attrs),
    }, props.islandComponent ? [h(props.islandComponent, attrs)] : [])

    if (!isServer || props.cacheTtl === undefined) {
      return renderNormal
    }

    if (!props.cacheKey) {
      console.warn(`[vike-islands] Island "${props.islandName}" has server:cache but no cache-key. Add cache-key="unique-key" to enable caching.`)
      return renderNormal
    }

    const cacheAdapter = getCacheAdapter()
    const cacheKey = makeCacheKey(props.islandName, props.cacheKey)

    let innerHtml: string | null = null
    if (cacheAdapter) {
      innerHtml = await cacheAdapter.get(cacheKey)
    }

    if (innerHtml === null) {
      const { renderToString } = await import('vue/server-renderer')
      const { defineComponent: dc, h: hh, Suspense } = await import('vue')
      const instance = getCurrentInstance()!
      const componentProps = attrs as Record<string, unknown>
      const app = createSSRApp(dc({
        setup: () => () => hh(Suspense, null, { default: () => hh(props.islandComponent!, componentProps) }),
      }))
      Object.assign(app._context, instance.appContext)
      innerHtml = await renderToString(app)

      if (cacheAdapter) {
        await cacheAdapter.set(cacheKey, innerHtml, props.cacheTtl)
      }
    }

    const html = innerHtml
    const isNeverHydrate = props.dataHydrate === 'never'
    return () => h('div', {
      'data-island': props.islandName,
      'data-island-id': props.islandId,
      'data-hydrate': props.dataHydrate,
      ...(isNeverHydrate ? {} : { 'data-island-props': JSON.stringify(attrs) }),
      innerHTML: html,
    })
  },
})
</script>
