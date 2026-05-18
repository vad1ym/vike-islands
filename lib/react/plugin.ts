import { vikeIslandsPlugin } from '../plugin/index'
import { reactTransformHook } from './transform'
import type { IslandCacheAdapter } from '../core/cache'
import type { Plugin } from 'vite'

export interface VikeIslandsReactOptions {
  cache?: IslandCacheAdapter
}

export function vikeIslands(options?: VikeIslandsReactOptions): Plugin {
  return vikeIslandsPlugin({
    framework: 'react',
    transform: reactTransformHook,
    cache: options?.cache,
  })
}
