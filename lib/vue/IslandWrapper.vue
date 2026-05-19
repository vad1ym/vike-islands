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

    // SSR + cache configured
    const instance = getCurrentInstance()!
    const cacheAdapter = getCacheAdapter()
    const componentProps = attrs as Record<string, unknown>
    const cacheKey = makeCacheKey(props.islandName, componentProps)

    let innerHtml: string | null = null

    if (cacheAdapter) {
      innerHtml = await cacheAdapter.get(cacheKey)
    }

    if (innerHtml === null) {
      const { renderToString } = await import('vue/server-renderer')
      const { defineComponent: dc, h: hh, Suspense } = await import('vue')
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
      ...(isNeverHydrate || props.cacheTtl !== undefined ? {} : { 'data-island-props': JSON.stringify(componentProps) }),
      innerHTML: html,
    })
  },
})
</script>
