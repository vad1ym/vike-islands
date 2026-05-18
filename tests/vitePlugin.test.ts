import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Plugin } from 'vite'
import { vikeIslandsPlugin } from '../lib/vite-plugin'

function getPlugin(): Plugin {
  return vikeIslandsPlugin() as Plugin
}

function transform(plugin: Plugin, code: string, id = 'Component.vue'): string | null {
  const result = (plugin.transform as ((code: string, id: string) => string | null | undefined) | undefined)?.(code, id)
  return result ?? null
}

const SIMPLE_SFC = `
<template>
  <Counter v-island :count="1" />
</template>
<script setup lang="ts">
import Counter from './Counter.island.vue'
</script>
`.trim()

const NO_ISLAND_SFC = `
<template>
  <Counter :count="1" />
</template>
`.trim()

describe('vikeIslandsPlugin', () => {
  let plugin: Plugin

  beforeEach(() => {
    plugin = getPlugin()
    ;(plugin.configResolved as ((config: { root: string }) => void) | undefined)?.({
      root: path.resolve('.'),
    })
    ;(plugin.buildStart as (() => void) | undefined)?.()
  })

  it('returns null for non-vue files', () => {
    expect(transform(plugin, 'const x = 1', 'file.ts')).toBeNull()
  })

  it('returns null for .vue files without v-island', () => {
    expect(transform(plugin, NO_ISLAND_SFC)).toBeNull()
  })

  it('wraps island component with IslandWrapper', () => {
    const result = transform(plugin, SIMPLE_SFC)
    expect(result).not.toBeNull()
    expect(result).toContain('<IslandWrapper')
    expect(result).toContain('island-name="Counter"')
    expect(result).toContain('island-id=')
  })

  it('sets data-hydrate to default "visible"', () => {
    const result = transform(plugin, SIMPLE_SFC)!
    expect(result).toContain('data-hydrate="visible"')
  })

  it('sets data-update to default "static"', () => {
    const result = transform(plugin, SIMPLE_SFC)!
    expect(result).toContain('data-update="static"')
  })

  it('keeps component props on IslandWrapper', () => {
    const result = transform(plugin, SIMPLE_SFC)!
    expect(result).toContain(':count="1"')
  })

  it('removes v-island directive from output', () => {
    const result = transform(plugin, SIMPLE_SFC)!
    expect(result).not.toContain('v-island')
  })

  it('injects IslandWrapper import', () => {
    const result = transform(plugin, SIMPLE_SFC)!
    expect(result).toContain("import IslandWrapper from 'vike-islands/IslandWrapper'")
  })

  it('respects explicit hydrate mode in v-island value', () => {
    const sfc = SIMPLE_SFC.replace('v-island', `v-island="{ hydrate: 'idle', update: 'patch' }"`)
    const result = transform(plugin, sfc)!
    expect(result).toContain('data-hydrate="idle"')
    expect(result).toContain('data-update="patch"')
  })

  it('resolveId returns resolved id for virtual client module', () => {
    const resolved = (plugin.resolveId as ((id: string) => string | undefined) | undefined)?.('virtual:vike-islands/client')
    expect(resolved).toBe('\0virtual:vike-islands/client')
  })

  it('resolveId returns undefined for other ids', () => {
    const resolved = (plugin.resolveId as ((id: string) => string | undefined) | undefined)?.('some-other-module')
    expect(resolved).toBeUndefined()
  })

  it('load generates lazy imports for *.island.vue files', () => {
    const code = (plugin.load as ((id: string) => string | undefined) | undefined)?.('\0virtual:vike-islands/client') ?? ''
    expect(code).toContain(`import { hydrateIslands } from 'vike-islands/runtime'`)
    expect(code).toContain(`"Counter": () => import("/examples/vue/components/Counter.island.vue")`)
    expect(code).toContain(`"ProductList": () => import("/examples/vue/components/ProductList.island.vue")`)
    expect(code).toContain('hydrateIslands(islandLoaders)')
  })

  it('generates multiple island ids when multiple islands are present', () => {
    const sfc = `
<template>
  <Counter v-island :count="1" />
  <UserMenu v-island :user-id="42" />
</template>
    `.trim()

    const result = transform(plugin, sfc)!
    const ids = [...result.matchAll(/island-id="(i\d+)"/g)].map((match) => match[1])
    expect(ids).toHaveLength(2)
    expect(new Set(ids).size).toBe(2)
  })
})
