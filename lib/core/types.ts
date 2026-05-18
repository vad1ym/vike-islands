export type HydrateMode = 'load' | 'idle' | 'visible' | 'interaction' | 'manual' | 'never'

export type UpdateMode = 'static' | 'patch' | 'remount'

export interface IslandOptions {
  hydrate?: HydrateMode
  update?: UpdateMode
}

export const ISLAND_DEFAULTS: Required<IslandOptions> = {
  hydrate: 'visible',
  update: 'static',
}
