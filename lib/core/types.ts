export type HydrateMode = 'load' | 'idle' | 'visible' | 'interaction' | 'manual' | 'never'

export type UpdateMode = 'static' | 'patch' | 'remount'

export interface IslandOptions {
  hydrate?: HydrateMode
  /** Cache TTL in seconds. Requires cache adapter passed to vikeIslands({ cache }) */
  cache?: number
}

export type ResolvedIslandOptions = Required<Omit<IslandOptions, 'cache' | 'cacheKey'>> & { cache?: number; cacheKey?: string }

export const ISLAND_DEFAULTS: ResolvedIslandOptions = {
  hydrate: 'load',
  cache: undefined,
}
