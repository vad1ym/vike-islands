import fs from 'node:fs'
import path from 'node:path'
import { mergeConfig, type Plugin, type UserConfig } from 'vite'
import { parse as parseSFC } from '@vue/compiler-sfc'
import {
  parse as parseTemplate,
  NodeTypes,
  ElementTypes,
} from '@vue/compiler-dom'
import type {
  ElementNode,
  AttributeNode,
  DirectiveNode,
  TemplateChildNode,
} from '@vue/compiler-dom'
import { ISLAND_DEFAULTS } from '../core/types'
import type { IslandOptions } from '../core/types'

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
}

let _counter = 0

function nextId(): string {
  return `i${++_counter}`
}

function resetCounter(): void {
  _counter = 0
}

function parseIslandOptions(raw: string | undefined): Required<IslandOptions> {
  const opts: Required<IslandOptions> = { ...ISLAND_DEFAULTS }
  if (!raw) return opts

  const trimmed = raw.trim().replace(/^['"](.*)['"]$/, '$1')

  const hydrateShorthands = ['load', 'idle', 'visible', 'interaction', 'manual', 'never'] as const
  if (hydrateShorthands.includes(trimmed as (typeof hydrateShorthands)[number])) {
    opts.hydrate = trimmed as Required<IslandOptions>['hydrate']
    return opts
  }

  try {
    const json = trimmed
      .replace(/'/g, '"')
      .replace(/(\w+)\s*:/g, '"$1":')
    const parsed = JSON.parse(json)
    if (parsed.hydrate) opts.hydrate = parsed.hydrate
    if (parsed.update) opts.update = parsed.update
  } catch {
    // ignore malformed options
  }

  return opts
}

interface IslandNode {
  node: ElementNode
  options: Required<IslandOptions>
  start: number
  end: number
}

function collectIslandNodes(root: { children?: TemplateChildNode[] }): IslandNode[] {
  const results: IslandNode[] = []

  function walk(node: any): void {
    if (!node) return

    if (node.type === NodeTypes.ELEMENT) {
      const el = node as ElementNode

      const isComponent =
        el.tagType === ElementTypes.COMPONENT ||
        /^[A-Z]/.test(el.tag) ||
        el.tag.includes('.')

      if (isComponent) {
        for (const prop of el.props) {
          const isVIsland =
            (prop.type === NodeTypes.DIRECTIVE && (prop as DirectiveNode).name === 'island') ||
            (prop.type === NodeTypes.ATTRIBUTE && (prop as AttributeNode).name === 'v-island')

          if (!isVIsland) continue

          let rawValue: string | undefined
          if (prop.type === NodeTypes.DIRECTIVE) {
            rawValue = (prop as DirectiveNode).exp?.loc.source
          } else {
            rawValue = (prop as AttributeNode).value?.content
          }

          results.push({
            node: el,
            options: parseIslandOptions(rawValue),
            start: el.loc.start.offset,
            end: el.loc.end.offset,
          })
          break
        }
      }

      for (const child of el.children ?? []) walk(child)
      return
    }

    for (const branch of node.branches ?? []) walk(branch)
    for (const child of node.children ?? []) walk(child)
  }

  for (const child of root.children ?? []) walk(child)
  return results
}

function serializePropsFromNode(el: ElementNode): string {
  const parts: string[] = []
  for (const prop of el.props) {
    const isVIsland =
      (prop.type === NodeTypes.DIRECTIVE && (prop as DirectiveNode).name === 'island') ||
      (prop.type === NodeTypes.ATTRIBUTE && (prop as AttributeNode).name === 'v-island')
    if (isVIsland) continue
    parts.push(prop.loc.source)
  }
  return parts.join(' ')
}

function transformSFC(
  code: string,
  templateSource: string,
  templateOffset: number,
): string | null {
  const ast = parseTemplate(templateSource, {
    parseMode: 'html',
    prefixIdentifiers: false,
  })

  const islands = collectIslandNodes(ast)
  if (islands.length === 0) return null

  let result = templateSource

  for (const { node, options, start, end } of [...islands].sort((a, b) => b.start - a.start)) {
    const id = nextId()
    const propsAttr = serializePropsFromNode(node)

    const replacement = `<IslandWrapper island-name="${node.tag}" island-id="${id}" data-hydrate="${options.hydrate}" data-update="${options.update}" :island-component="${node.tag}"${propsAttr ? ` ${propsAttr}` : ''} />`

    result = result.slice(0, start) + replacement + result.slice(end)
  }

  let transformed = (
    code.slice(0, templateOffset) +
    result +
    code.slice(templateOffset + templateSource.length)
  )

  const wrapperImport = `import IslandWrapper from 'vike-islands/vue/IslandWrapper'`
  if (!transformed.includes(wrapperImport)) {
    const scriptSetupMatch = transformed.match(/<script\b[^>]*\bsetup\b[^>]*>/)
    if (scriptSetupMatch?.index !== undefined) {
      const insertAt = scriptSetupMatch.index + scriptSetupMatch[0].length
      transformed = transformed.slice(0, insertAt) + `\n${wrapperImport}` + transformed.slice(insertAt)
    } else {
      transformed = `<script setup>\n${wrapperImport}\n</script>\n${transformed}`
    }
  }

  return transformed
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
  const { framework } = options

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
      resetCounter()
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

    transform(code: string, id: string) {
      if (framework !== 'vue') return
      if (!id.endsWith('.vue')) return
      if (!code.includes('v-island')) return
      if (code.includes('data-island=')) return

      const { descriptor, errors } = parseSFC(code, { filename: id })
      if (errors.length > 0 || !descriptor.template) return

      const { content: templateSource, loc } = descriptor.template
      return transformSFC(code, templateSource, loc.start.offset)
    },
  }
}
