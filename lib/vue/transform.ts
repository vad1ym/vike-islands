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

let _counter = 0

export function nextId(): string {
  return `i${++_counter}`
}

export function resetCounter(): void {
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

export function vueTransformHook(code: string, id: string): string | null | undefined {
  if (!id.endsWith('.vue')) return
  if (!code.includes('v-island')) return
  if (code.includes('data-island=')) return

  const { descriptor, errors } = parseSFC(code, { filename: id })
  if (errors.length > 0 || !descriptor.template) return

  const { content: templateSource, loc } = descriptor.template
  return transformSFC(code, templateSource, loc.start.offset)
}
