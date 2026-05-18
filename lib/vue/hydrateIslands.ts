import type { Component } from 'vue'
import { createIslandHydrator } from '../core/hydrateIslands'

type VueRuntimeModule = Pick<typeof import('vue'), 'createApp' | 'h'>

export type IslandLoader = () => Promise<Component>
export type IslandLoaderMap = Record<string, IslandLoader>

export interface HydrateIslandsOptions {
  loaders: IslandLoaderMap
  loadVueRuntime: () => Promise<VueRuntimeModule>
}

let _hydrator: ReturnType<typeof createIslandHydrator<Component, VueRuntimeModule>> | null = null

function getHydrator(loadRuntime: () => Promise<VueRuntimeModule>) {
  if (!_hydrator) {
    _hydrator = createIslandHydrator<Component, VueRuntimeModule>({
      loaders: {},
      loadRuntime,
      isAlreadyMounted: (node) => !!(node as any).__vue_app__,
      mount(el, Comp, props, { createApp, h }) {
        while (el.firstChild) el.removeChild(el.firstChild)
        createApp({ render: () => h(Comp, props) }).mount(el)
      },
    })
  }
  return _hydrator
}

export function hydrateIslands(options: HydrateIslandsOptions): void {
  getHydrator(options.loadVueRuntime).hydrateIslands(options.loaders)
}

export function hydrateIslandById(id: string): Promise<void> {
  if (!_hydrator) {
    console.warn('[vike-islands] hydrateIslands() must be called before hydrateIslandById()')
    return Promise.resolve()
  }
  return _hydrator.hydrateIslandById(id)
}
