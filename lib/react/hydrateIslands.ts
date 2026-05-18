import type { ComponentType } from 'react'
import { createIslandHydrator } from '../core/hydrateIslands'

type ReactRuntimeModule = {
  createElement: (type: ComponentType<any>, props?: Record<string, unknown>) => unknown
  hydrateRoot: (container: Element | DocumentFragment, children: unknown) => unknown
  createRoot?: (container: Element | DocumentFragment) => { render(children: unknown): void }
}

export type IslandLoader = () => Promise<ComponentType<any>>
export type IslandLoaderMap = Record<string, IslandLoader>

export interface HydrateIslandsOptions {
  loaders: IslandLoaderMap
  loadReactRuntime: () => Promise<ReactRuntimeModule>
}

let _hydrator: ReturnType<typeof createIslandHydrator<ComponentType<any>, ReactRuntimeModule>> | null = null

function getHydrator(loadRuntime: () => Promise<ReactRuntimeModule>) {
  if (!_hydrator) {
    _hydrator = createIslandHydrator<ComponentType<any>, ReactRuntimeModule>({
      loaders: {},
      loadRuntime,
      isAlreadyMounted: (node) => !!(node as any).__vike_islands_react_root__,
      mount(el, Comp, props, { createElement, hydrateRoot, createRoot }) {
        const tree = createElement(Comp, props)
        ;(el as any).__vike_islands_react_root__ = createRoot
          ? createRoot(el)
          : hydrateRoot(el, tree)
        if ((el as any).__vike_islands_react_root__?.render) {
          ;(el as any).__vike_islands_react_root__.render(tree)
        }
      },
    })
  }
  return _hydrator
}

export function hydrateIslands(options: HydrateIslandsOptions): void {
  getHydrator(options.loadReactRuntime).hydrateIslands(options.loaders)
}

export function hydrateIslandById(id: string): Promise<void> {
  if (!_hydrator) {
    console.warn('[vike-islands] hydrateIslands() must be called before hydrateIslandById()')
    return Promise.resolve()
  }
  return _hydrator.hydrateIslandById(id)
}
