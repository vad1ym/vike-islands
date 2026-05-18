import fs from 'node:fs'
import path from 'node:path'
import { mergeConfig, type Plugin, type UserConfig } from 'vite'

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
  /**
   * Optional transform hook — framework adapters inject their own file transform here.
   * Called for every file Vite processes; return null/undefined to skip.
   */
  transform?: (code: string, id: string) => string | null | undefined
  /**
   * Called at the start of each build — use to reset per-build state in the adapter.
   */
  onBuildStart?: () => void
}

function normalizePathForVite(filePath: string): string {
  return filePath.split(path.sep).join('/')
}

function getIslandFileSuffixes(framework: SupportedFramework): string[] {
  return framework === 'react'
    ? ['.island.tsx', '.island.jsx']
    : ['.island.vue']
}

function scanIslandFiles(rootDir: string, framework: SupportedFramework): string[] {
  const files: string[] = []
  const suffixes = getIslandFileSuffixes(framework)

  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (SKIPPED_DIRS.has(entry.name)) continue
        walk(path.join(dir, entry.name))
        continue
      }

      if (entry.isFile() && suffixes.some((suffix) => entry.name.endsWith(suffix))) {
        files.push(path.join(dir, entry.name))
      }
    }
  }

  walk(rootDir)
  return files.sort()
}

function getIslandName(filePath: string, framework: SupportedFramework): string {
  const suffix = getIslandFileSuffixes(framework).find((candidate) => filePath.endsWith(candidate))
  if (!suffix) {
    throw new Error(`[vike-islands] Unsupported island file: ${filePath}`)
  }
  return path.basename(filePath, suffix)
}

function validateIslandFiles(rootDir: string, framework: SupportedFramework): Map<string, string> {
  const islandFiles = scanIslandFiles(rootDir, framework)
  const filesByName = new Map<string, string[]>()

  for (const filePath of islandFiles) {
    const name = getIslandName(filePath, framework)
    const list = filesByName.get(name) ?? []
    list.push(filePath)
    filesByName.set(name, list)
  }

  const duplicates = [...filesByName.entries()].filter(([, files]) => files.length > 1)
  if (duplicates.length > 0) {
    const details = duplicates
      .map(([name, files]) => `${name}: ${files.map((file) => path.relative(rootDir, file)).join(', ')}`)
      .join('\n')
    throw new Error(`[vike-islands] Duplicate island component names found.\n${details}`)
  }

  return new Map([...filesByName.entries()].map(([name, [filePath]]) => [name, filePath]))
}

function addBuildInputs(
  rootDir: string,
  framework: SupportedFramework,
  input: NonNullable<NonNullable<UserConfig['build']>['rollupOptions']>['input'],
): Record<string, string> {
  const islandFiles = validateIslandFiles(rootDir, framework)

  const islandsInputs = Object.fromEntries(
    [...islandFiles.keys()].map((name) => [`vike-islands-component-${name}`, `${ISLANDS_COMPONENT_PUBLIC_PREFIX}${name}`]),
  )
  const runtimeEntries: Record<string, string> = framework === 'react'
    ? { [ISLANDS_REACT_RUNTIME_NAME]: ISLANDS_REACT_RUNTIME_PUBLIC_ID }
    : { [ISLANDS_VUE_RUNTIME_NAME]: ISLANDS_VUE_RUNTIME_PUBLIC_ID }

  if (!input) {
    return { ...runtimeEntries, ...islandsInputs }
  }
  if (typeof input === 'string') {
    return { main: input, ...runtimeEntries, ...islandsInputs }
  }
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
    return
  }

  if (!existing) return ours
  if (typeof existing === 'function') {
    return (id: string, meta: unknown) => ours(id) ?? existing(id, meta as never)
  }

  return existing
}

export function vikeIslandsPlugin(options: VikeIslandsPluginOptions): Plugin {
  let rootDir = process.cwd()
  const { framework, transform, onBuildStart } = options

  return {
    name: 'vike-islands',
    enforce: 'pre',

    configResolved(config) {
      rootDir = config.root
    },

    config(config) {
      const scanRoot = path.resolve(config.root ?? process.cwd())
      const existingOutput = Array.isArray(config.build?.rollupOptions?.output)
        ? config.build?.rollupOptions?.output[0]
        : config.build?.rollupOptions?.output

      return mergeConfig(config, {
        build: {
          rollupOptions: {
            input: addBuildInputs(scanRoot, framework, config.build?.rollupOptions?.input),
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

    resolveId: {
      filter: {
        id: new RegExp(`^(${ISLANDS_VUE_RUNTIME_PUBLIC_ID.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|${ISLANDS_REACT_RUNTIME_PUBLIC_ID.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|${ISLANDS_COMPONENT_PUBLIC_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.+)$`),
      },
      handler(id) {
        if (id === ISLANDS_VUE_RUNTIME_PUBLIC_ID) return RESOLVED_ISLANDS_VUE_RUNTIME_ID
        if (id === ISLANDS_REACT_RUNTIME_PUBLIC_ID) return RESOLVED_ISLANDS_REACT_RUNTIME_ID
        if (id.startsWith(ISLANDS_COMPONENT_PUBLIC_PREFIX)) return `${RESOLVED_ISLANDS_COMPONENT_PREFIX}${id.slice(ISLANDS_COMPONENT_PUBLIC_PREFIX.length)}`
      },
    },

    load: {
      filter: {
        id: new RegExp(`^(${RESOLVED_ISLANDS_VUE_RUNTIME_ID.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|${RESOLVED_ISLANDS_REACT_RUNTIME_ID.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|${RESOLVED_ISLANDS_COMPONENT_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.+)$`),
      },
      handler(id) {
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
          const islandFiles = validateIslandFiles(rootDir, framework)
          const filePath = islandFiles.get(islandName)
          if (!filePath) {
            throw new Error(`[vike-islands] Island component "${islandName}" not found.`)
          }
          const importPath = `/${normalizePathForVite(path.relative(rootDir, filePath))}`
          return `export { default } from ${JSON.stringify(importPath)}`
        }
      },
    },

    transform: transform
      ? (code: string, id: string) => transform(code, id) ?? undefined
      : undefined,
  }
}
