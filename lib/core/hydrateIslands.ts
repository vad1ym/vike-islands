import { runHydrationStrategy } from './strategies'
import type { HydrateMode, UpdateMode } from './types'

export interface IslandEntry {
  id: string
  name: string
  hydrate: HydrateMode
  update: UpdateMode
  props: Record<string, unknown>
  el: HTMLElement
}

export type IslandLoader<C> = () => Promise<C>
export type IslandLoaderMap<C> = Record<string, IslandLoader<C>>

export interface HydrateIslandsOptions<C, R> {
  loaders: IslandLoaderMap<C>
  loadRuntime: () => Promise<R>
  mount: (el: HTMLElement, Component: C, props: Record<string, unknown>, runtime: R) => void
  isAlreadyMounted?: (el: HTMLElement) => boolean
}

export function collectIslands(): IslandEntry[] {
  const entries: IslandEntry[] = []

  for (const el of Array.from(document.querySelectorAll<HTMLElement>('[data-island]'))) {
    const id = el.dataset.islandId
    if (!id) continue

    const name = el.dataset.island!
    const hydrate = (el.dataset.hydrate ?? 'visible') as HydrateMode
    const update = (el.dataset.update ?? 'static') as UpdateMode

    let props: Record<string, unknown> = {}
    if (el.dataset.islandProps) {
      try {
        props = JSON.parse(el.dataset.islandProps)
      } catch (err) {
        console.warn(`[vike-islands] Failed to parse props for island "${id}"`, err)
      }
    }

    entries.push({ id, name, hydrate, update, props, el })
  }

  return entries
}

export function createIslandHydrator<C, R>(options: HydrateIslandsOptions<C, R>) {
  const hydratedIds = new Set<string>()
  const componentPromises = new Map<string, Promise<C>>()
  let runtimePromise: Promise<R> | null = null

  let loaders: IslandLoaderMap<C> = options.loaders
  let loadRuntime = options.loadRuntime
  const { mount, isAlreadyMounted } = options

  async function mountIsland(entry: IslandEntry): Promise<void> {
    const { el, id, name, props } = entry

    if (hydratedIds.has(id)) return

    if (isAlreadyMounted) {
      let node: HTMLElement | null = el
      while (node) {
        if (isAlreadyMounted(node)) return
        node = node.parentElement
      }
    }

    const loader = loaders[name]
    if (!loader) {
      console.warn(`[vike-islands] Component "${name}" is not registered.`)
      return
    }

    hydratedIds.add(id)

    let componentPromise = componentPromises.get(name)
    if (!componentPromise) {
      componentPromise = loader()
      componentPromises.set(name, componentPromise)
    }

    runtimePromise ??= loadRuntime()

    const [Component, runtime] = await Promise.all([componentPromise, runtimePromise])
    mount(el, Component, props, runtime)
  }

  function hydrateIslands(extraLoaders?: IslandLoaderMap<C>): void {
    if (extraLoaders) {
      loaders = { ...loaders, ...extraLoaders }
    }

    for (const entry of collectIslands()) {
      runHydrationStrategy(entry.hydrate, entry.el, () => mountIsland(entry))
    }
  }

  async function hydrateIslandById(id: string): Promise<void> {
    const el = document.querySelector<HTMLElement>(`[data-island-id="${id}"]`)
    if (!el) {
      console.warn(`[vike-islands] No island found with id "${id}"`)
      return
    }

    const name = el.dataset.island!
    const hydrate = (el.dataset.hydrate ?? 'visible') as HydrateMode
    const update = (el.dataset.update ?? 'static') as UpdateMode
    let props: Record<string, unknown> = {}
    if (el.dataset.islandProps) {
      try { props = JSON.parse(el.dataset.islandProps) } catch {}
    }

    await mountIsland({ id, name, hydrate, update, props, el })
  }

  return { hydrateIslands, hydrateIslandById }
}
