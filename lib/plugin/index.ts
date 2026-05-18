import fs from 'node:fs'
import path from 'node:path'
import { mergeConfig, type Plugin, type UserConfig } from 'vite'
import type { IslandCacheAdapter } from '../core/cache'

const GLOBAL_CACHE_KEY = '__vikeIslandsCacheAdapter__'

const ISLANDS_REACT_RUNTIME_PUBLIC_ID = '/@vike-islands/react-runtime'
const RESOLVED_ISLANDS_REACT_RUNTIME_ID = '\0vike-islands:react-runtime'
const ISLANDS_REACT_RUNTIME_NAME = 'vike-islands-react-runtime'
const ISLANDS_VUE_RUNTIME_PUBLIC_ID = '/@vike-islands/vue-runtime'
const RESOLVED_ISLANDS_VUE_RUNTIME_ID = '\0vike-islands:vue-runtime'
const ISLANDS_VUE_RUNTIME_NAME = 'vike-islands-vue-runtime'
const ISLANDS_COMPONENT_PUBLIC_PREFIX = '/@vike-islands/component/'
const RESOLVED_ISLANDS_COMPONENT_PREFIX = '\0vike-islands:component:'
const SKIPPED_DIRS = new Set(['.git', '.vite', 'dist', 'node_modules'])

export type SupportedFramework = 'vue' | 'react'

export interface VikeIslandsPluginOptions {
  framework: SupportedFramework
  transform?: (code: string, id: string) => string | null | undefined
  onBuildStart?: () => void
  cache?: IslandCacheAdapter
}

function normalizePathForVite(filePath: string): string {
  return filePath.split(path.sep).join('/')
}

type AliasEntry = { find: string | RegExp; replacement: string }

function resolveAlias(specifier: string, aliases: AliasEntry[]): string | null {
  for (const { find, replacement } of aliases) {
    if (typeof find === 'string') {
      if (specifier.startsWith(find)) {
        return replacement + specifier.slice(find.length)
      }
    } else if (find.test(specifier)) {
      return specifier.replace(find, replacement)
    }
  }
  return null
}

// Grep all source files for `?island` imports, resolve paths, return islandName -> filePath.
function scanIslandImports(rootDir: string, aliases: AliasEntry[]): Map<string, string> {
  const result = new Map<string, string>()
  const extensions = ['.vue', '.tsx', '.jsx', '.ts', '.js']

  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (SKIPPED_DIRS.has(entry.name)) continue
        walk(path.join(dir, entry.name))
        continue
      }
      if (!entry.isFile() || !extensions.some(ext => entry.name.endsWith(ext))) continue

      const filePath = path.join(dir, entry.name)
      const code = fs.readFileSync(filePath, 'utf8')
      if (!code.includes('?island')) continue

      const importPattern = /from\s+['"]([^'"]+\?island)['"]/g
      let m: RegExpExecArray | null
      while ((m = importPattern.exec(code)) !== null) {
        const specifier = m[1].replace('?island', '')

        let resolved: string
        if (specifier.startsWith('.')) {
          resolved = path.resolve(path.dirname(filePath), specifier)
        } else {
          const aliased = resolveAlias(specifier, aliases)
          if (!aliased) continue
          resolved = aliased
        }

        // Try with and without extension
        const candidates = fs.existsSync(resolved)
          ? [resolved]
          : extensions.map(ext => resolved + ext).filter(fs.existsSync)

        if (candidates.length === 0) continue

        const resolvedPath = candidates[0]
        const ext = path.extname(resolvedPath)
        const islandName = path.basename(resolvedPath, ext)
        result.set(islandName, resolvedPath)
      }
    }
  }

  walk(rootDir)
  return result
}

function addBuildInputs(
  rootDir: string,
  aliases: AliasEntry[],
  framework: SupportedFramework,
  input: NonNullable<NonNullable<UserConfig['build']>['rollupOptions']>['input'],
): Record<string, string> {
  const islandFiles = scanIslandImports(rootDir, aliases)

  const islandsInputs = Object.fromEntries(
    [...islandFiles.keys()].map((name) => [`vike-islands-component-${name}`, `${ISLANDS_COMPONENT_PUBLIC_PREFIX}${name}`]),
  )
  const runtimeEntries: Record<string, string> = framework === 'react'
    ? { [ISLANDS_REACT_RUNTIME_NAME]: ISLANDS_REACT_RUNTIME_PUBLIC_ID }
    : { [ISLANDS_VUE_RUNTIME_NAME]: ISLANDS_VUE_RUNTIME_PUBLIC_ID }

  if (!input) return { ...runtimeEntries, ...islandsInputs }
  if (typeof input === 'string') return { main: input, ...runtimeEntries, ...islandsInputs }
  if (Array.isArray(input)) {
    return Object.fromEntries([
      ...input.map((value, index) => [`entry${index}`, value]),
      ...Object.entries(runtimeEntries),
      ...Object.entries(islandsInputs),
    ])
  }
  return { ...input, ...runtimeEntries, ...islandsInputs }
}

function mergeManualChunks(existing: any, framework: SupportedFramework): any {
  const ours = (id: string): string | undefined => {
    if (framework === 'react' && (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/'))) return 'react-runtime'
    if (framework === 'vue' && (id.includes('/node_modules/@vue/') || id.includes('/node_modules/vue/'))) return 'vue-runtime'
    if (id.includes('/node_modules/vike/dist/client/')) return 'vike-runtime'
  }

  if (!existing) return ours
  if (typeof existing === 'function') return (id: string, meta: unknown) => ours(id) ?? existing(id, meta as never)
  return existing
}

export function vikeIslandsPlugin(options: VikeIslandsPluginOptions): Plugin {
  let rootDir = process.cwd()
  let aliases: AliasEntry[] = []
  const { framework, transform, onBuildStart, cache } = options

  if (cache) {
    ;(globalThis as any)[GLOBAL_CACHE_KEY] = cache
  }

  return {
    name: 'vike-islands',
    enforce: 'pre',

    configResolved(config) {
      rootDir = config.root
      const raw = config.resolve?.alias ?? []
      aliases = Array.isArray(raw)
        ? raw
        : Object.entries(raw).map(([find, replacement]) => ({ find, replacement: replacement as string }))
    },

    config(config) {
      const scanRoot = path.resolve(config.root ?? process.cwd())
      // Build aliases from config for scanning (configResolved not yet called)
      const rawAliases = config.resolve?.alias ?? []
      const configAliases: AliasEntry[] = Array.isArray(rawAliases)
        ? rawAliases
        : Object.entries(rawAliases).map(([find, replacement]) => ({ find, replacement: replacement as string }))

      const existingOutput = Array.isArray(config.build?.rollupOptions?.output)
        ? config.build?.rollupOptions?.output[0]
        : config.build?.rollupOptions?.output

      return mergeConfig(config, {
        build: {
          rollupOptions: {
            input: addBuildInputs(scanRoot, configAliases, framework, config.build?.rollupOptions?.input),
            preserveEntrySignatures: 'strict',
            output: {
              manualChunks: mergeManualChunks(existingOutput?.manualChunks, framework),
            },
          },
        },
      })
    },

    buildStart() {
      onBuildStart?.()
    },

    resolveId(id, importer) {
      if (id === ISLANDS_VUE_RUNTIME_PUBLIC_ID) return RESOLVED_ISLANDS_VUE_RUNTIME_ID
      if (id === ISLANDS_REACT_RUNTIME_PUBLIC_ID) return RESOLVED_ISLANDS_REACT_RUNTIME_ID
      if (id.startsWith(ISLANDS_COMPONENT_PUBLIC_PREFIX)) {
        return `${RESOLVED_ISLANDS_COMPONENT_PREFIX}${id.slice(ISLANDS_COMPONENT_PUBLIC_PREFIX.length)}`
      }
      // Strip ?island and resolve the bare path via the normal resolver
      if (id.endsWith('?island')) {
        return this.resolve(id.replace('?island', ''), importer, { skipSelf: true }).then(resolved =>
          resolved ? { id: resolved.id, moduleSideEffects: false } : null
        )
      }
    },

    load(id: string) {
      if (id === RESOLVED_ISLANDS_VUE_RUNTIME_ID) {
        return [
          `import * as vue from 'vue'`,
          `export const createApp = vue.createApp`,
          `export const h = vue.h`,
          `export default { createApp: vue.createApp, h: vue.h }`,
          '',
        ].join('\n')
      }
      if (id === RESOLVED_ISLANDS_REACT_RUNTIME_ID) {
        return [
          `import React from 'react'`,
          `import * as ReactDOMClient from 'react-dom/client'`,
          `export const createElement = React.createElement`,
          `export const hydrateRoot = ReactDOMClient.hydrateRoot`,
          `export const createRoot = ReactDOMClient.createRoot`,
          `export default { createElement: React.createElement, hydrateRoot: ReactDOMClient.hydrateRoot, createRoot: ReactDOMClient.createRoot }`,
          '',
        ].join('\n')
      }
      if (id.startsWith(RESOLVED_ISLANDS_COMPONENT_PREFIX)) {
        const islandName = id.slice(RESOLVED_ISLANDS_COMPONENT_PREFIX.length)
        const islandFiles = scanIslandImports(rootDir, aliases)
        const filePath = islandFiles.get(islandName)
        if (!filePath) {
          throw new Error(`[vike-islands] Island component "${islandName}" not found.`)
        }
        const importPath = `/${normalizePathForVite(path.relative(rootDir, filePath))}`
        return `export { default } from ${JSON.stringify(importPath)}`
      }
    },

    transform: transform
      ? (code: string, id: string) => transform(code, id) ?? undefined
      : undefined,
  }
}
