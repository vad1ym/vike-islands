import { parse as parseSFC } from '@vue/compiler-sfc'
import {
  parse as parseTemplate,
  NodeTypes,
  ElementTypes,
} from '@vue/compiler-dom'
import type {
  ElementNode,
  AttributeNode,
  TemplateChildNode,
} from '@vue/compiler-dom'
import { ISLAND_DEFAULTS } from '../core/types'
import type { ResolvedIslandOptions } from '../core/types'

let _counter = 0

export function nextId(): string {
  return `i${++_counter}`
}

export function resetCounter(): void {
  _counter = 0
}

// Detects client:load, client:never, etc. and server:cache="TTL"
// Returns null if neither is found (not an island usage)
function parseClientServerAttrs(el: ElementNode): ResolvedIslandOptions | null {
  let hydrate = ISLAND_DEFAULTS.hydrate
  let cache: number | undefined
  let hasClientAttr = false
  let hasServerCache = false

  for (const prop of el.props) {
    // client:{mode} as plain attribute e.g. client:load
    if (prop.type === NodeTypes.ATTRIBUTE) {
      const attrName = (prop as AttributeNode).name
      if (attrName.startsWith('client:')) {
        hasClientAttr = true
        hydrate = attrName.slice('client:'.length) as ResolvedIslandOptions['hydrate']
      }
      if (attrName.startsWith('server:cache')) {
        hasServerCache = true
        const val = (prop as AttributeNode).value?.content
        cache = val ? Number(val) : undefined
      }
    }
  }

  if (!hasClientAttr && !hasServerCache) return null
  return { hydrate, cache }
}

interface IslandNode {
  node: ElementNode
  options: ResolvedIslandOptions
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
        const options = parseClientServerAttrs(el)
        if (options) {
          results.push({
            node: el,
            options,
            start: el.loc.start.offset,
            end: el.loc.end.offset,
          })
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
    if (prop.type === NodeTypes.ATTRIBUTE) {
      const name = (prop as AttributeNode).name
      if (name.startsWith('client:') || name.startsWith('server:')) continue
    }
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
    const cacheTtlAttr = options.cache !== undefined ? ` :cache-ttl="${options.cache}"` : ''
    const replacement = `<IslandWrapper island-name="${node.tag}" island-id="${id}" data-hydrate="${options.hydrate}"${cacheTtlAttr} :island-component="${node.tag}"${propsAttr ? ` ${propsAttr}` : ''}/>`
    result = result.slice(0, start) + replacement + result.slice(end)
  }

  let transformed = (
    code.slice(0, templateOffset) +
    result +
    code.slice(templateOffset + templateSource.length)
  )

  const imp = `import IslandWrapper from 'vike-islands/vue/IslandWrapper'`
  if (!transformed.includes(imp)) {
    const scriptSetupMatch = transformed.match(/<script\b[^>]*\bsetup\b[^>]*>/)
    if (scriptSetupMatch?.index !== undefined) {
      const insertAt = scriptSetupMatch.index + scriptSetupMatch[0].length
      transformed = transformed.slice(0, insertAt) + `\n${imp}` + transformed.slice(insertAt)
    } else {
      transformed = `<script setup>\n${imp}\n</script>\n${transformed}`
    }
  }

  return transformed
}

export function vueTransformHook(code: string, id: string): string | null | undefined {
  if (!id.endsWith('.vue')) return
  if (!code.includes('client:') && !code.includes('server:cache')) return
  if (code.includes('data-island=')) return

  const { descriptor, errors } = parseSFC(code, { filename: id })
  if (errors.length > 0 || !descriptor.template) return

  const { content: templateSource, loc } = descriptor.template
  return transformSFC(code, templateSource, loc.start.offset)
}
