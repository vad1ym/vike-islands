import { vikeIslandsPlugin } from '../plugin/index'
import type { Plugin } from 'vite'

export function vikeIslands(): Plugin {
  return vikeIslandsPlugin({ framework: 'vue' })
}
