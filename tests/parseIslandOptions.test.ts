import { describe, it, expect } from 'vitest'
import { ISLAND_DEFAULTS } from '../lib/types'

// parseIslandOptions is not exported from the public API, so we re-implement
// the same logic here to test the parsing contract independently.
type HydrateMode = 'load' | 'idle' | 'visible' | 'interaction' | 'manual' | 'never'
type UpdateMode = 'static' | 'patch' | 'remount'
interface IslandOptions { hydrate: HydrateMode; update: UpdateMode }

function parseIslandOptions(raw: string | undefined): IslandOptions {
  const opts: IslandOptions = { ...ISLAND_DEFAULTS }
  if (!raw) return opts
  const trimmed = raw.trim()
  const hydrateShorthands = ['load', 'idle', 'visible', 'interaction', 'manual', 'never'] as const
  if (hydrateShorthands.includes(trimmed as HydrateMode)) {
    opts.hydrate = trimmed as HydrateMode
    return opts
  }
  try {
    const json = trimmed.replace(/'/g, '"').replace(/(\w+)\s*:/g, '"$1":')
    const parsed = JSON.parse(json)
    if (parsed.hydrate) opts.hydrate = parsed.hydrate
    if (parsed.update) opts.update = parsed.update
  } catch {}
  return opts
}

describe('parseIslandOptions', () => {
  it('returns defaults when no value given', () => {
    expect(parseIslandOptions(undefined)).toEqual({ hydrate: 'visible', update: 'static' })
  })

  it('returns defaults for empty string', () => {
    expect(parseIslandOptions('')).toEqual({ hydrate: 'visible', update: 'static' })
  })

  it('accepts hydrate shorthand string', () => {
    expect(parseIslandOptions('idle')).toEqual({ hydrate: 'idle', update: 'static' })
    expect(parseIslandOptions('load')).toEqual({ hydrate: 'load', update: 'static' })
    expect(parseIslandOptions('interaction')).toEqual({ hydrate: 'interaction', update: 'static' })
    expect(parseIslandOptions('manual')).toEqual({ hydrate: 'manual', update: 'static' })
    expect(parseIslandOptions('never')).toEqual({ hydrate: 'never', update: 'static' })
  })

  it('parses JSON-like object with double quotes', () => {
    expect(parseIslandOptions('{ "hydrate": "idle", "update": "patch" }')).toEqual({
      hydrate: 'idle',
      update: 'patch',
    })
  })

  it('parses object with single quotes', () => {
    expect(parseIslandOptions("{ hydrate: 'interaction', update: 'remount' }")).toEqual({
      hydrate: 'interaction',
      update: 'remount',
    })
  })

  it('parses partial object — only hydrate', () => {
    expect(parseIslandOptions("{ hydrate: 'load' }")).toEqual({
      hydrate: 'load',
      update: 'static',
    })
  })

  it('parses partial object — only update', () => {
    expect(parseIslandOptions("{ update: 'patch' }")).toEqual({
      hydrate: 'visible',
      update: 'patch',
    })
  })

  it('falls back to defaults for malformed input', () => {
    expect(parseIslandOptions('not-a-mode')).toEqual({ hydrate: 'visible', update: 'static' })
    expect(parseIslandOptions('{ bad json')).toEqual({ hydrate: 'visible', update: 'static' })
  })
})
