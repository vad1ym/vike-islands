import { vikeIslandsPlugin } from '../plugin/index'
import { vueTransformHook, resetCounter } from './transform'
import type { Plugin } from 'vite'

export function vikeIslands(): Plugin {
  return vikeIslandsPlugin({
    framework: 'vue',
    transform: vueTransformHook,
    onBuildStart: resetCounter,
  })
}
