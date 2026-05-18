// @ts-ignore — vike-react exports this path at runtime but has no type declaration for it
import { onRenderHtml as vikeReactOnRenderHtmlAsync } from 'vike-react/__internal/integration/onRenderHtml'
import { dangerouslySkipEscape } from 'vike/server'
import type { OnRenderHtmlAsync } from 'vike/types'
import {
  findManifestEntry,
  getInlineRuntimeSource,
  getIslandsComponentAssets,
  getUsedIslandNames,
  hasIslands,
  joinAssetPath,
  serializeIslandsClientConfig,
  type ViteManifest,
} from '../core/onRenderHtmlCommon'

type PageContext = OnRenderHtmlAsync extends (pageContext: infer T) => any ? T : never

const ISLANDS_REACT_RUNTIME_PUBLIC_ID = '/@vike-islands/react-runtime'
const ISLANDS_REACT_RUNTIME_NAME = 'vike-islands-react-runtime'

function getReactRuntimeUrl(pageContext: PageContext): string | null {
  const globalContext = (pageContext as any)._globalContext
  const baseAssets = globalContext?.baseAssets ?? ''
  const isProduction = globalContext?._isProduction ?? !!globalContext?.assetsManifest

  if (!isProduction) {
    return joinAssetPath(baseAssets, ISLANDS_REACT_RUNTIME_PUBLIC_ID)
  }

  const assetsManifest = globalContext?.assetsManifest as ViteManifest | undefined
  if (!assetsManifest) return null

  const entry = findManifestEntry(assetsManifest, (e) => (
    !!e.isEntry && (e.name === ISLANDS_REACT_RUNTIME_NAME || e.src === 'vike-islands:react-runtime')
  ))
  if (!entry) return null
  return joinAssetPath(baseAssets, `/${entry.file}`)
}

function buildIslandsInjection(pageContext: PageContext, html: string): string | null {
  const islandNames = hasIslands(html) ? getUsedIslandNames(html) : []
  const components = islandNames.length > 0
    ? getIslandsComponentAssets(pageContext, islandNames)
    : {}
  const reactRuntime = getReactRuntimeUrl(pageContext)
  if (!reactRuntime || Object.keys(components).length === 0) return null

  const islandsClientConfig = serializeIslandsClientConfig({ reactRuntime, components })
  const inlineScript = [
    getInlineRuntimeSource(import.meta.url, 'runtime-react.js'),
    `const config = window.__VIKE_ISLANDS__`,
    `const importByUrl = new Function("u", "return import(u)")`,
    `if (config) {`,
    `  const loaders = Object.fromEntries(`,
    `    Object.entries(config.components).map(([name, url]) => [name, () => importByUrl(url).then((mod) => mod.default)]),`,
    `  )`,
    `  const loadReactRuntime = () => importByUrl(config.reactRuntime).then((mod) => mod.default ?? mod)`,
    `  hydrateIslands({`,
    `    loaders,`,
    `    loadReactRuntime,`,
    `  })`,
    `}`,
  ].join('\n').replace(/<\/script/gi, '<\\/script')

  return [
    `<script>window.__VIKE_ISLANDS__=${islandsClientConfig}</script>`,
    `<script type="module">${inlineScript}</script>`,
  ].join('\n')
}

export const onRenderHtml: OnRenderHtmlAsync = async (pageContext) => {
  const result = await vikeReactOnRenderHtmlAsync(pageContext)

  const documentHtml = (result as any).documentHtml
  const htmlString: string = typeof documentHtml?.toString === 'function'
    ? documentHtml.toString()
    : String(documentHtml ?? '')

  const injection = buildIslandsInjection(pageContext, htmlString)
  if (!injection) return result

  const patched = htmlString.replace('</body>', `${injection}\n</body>`)
  return {
    ...result,
    documentHtml: dangerouslySkipEscape(patched),
  }
}
