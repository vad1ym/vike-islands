import { vikeIslandsPlugin } from '../plugin/index'
import { vueTransformHook, resetCounter } from './transform'
import type { IslandCacheAdapter } from '../core/cache'
import type { Plugin } from 'vite'

export interface VikeIslandsVueOptions {
  cache?: IslandCacheAdapter
}

export function vikeIslands(options?: VikeIslandsVueOptions): Plugin {
  return vikeIslandsPlugin({
    framework: 'vue',
    transform: vueTransformHook,
    onBuildStart: resetCounter,
    cache: options?.cache,
  })
}
