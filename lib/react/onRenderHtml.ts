import React from 'react'
import { renderToString } from 'react-dom/server'
import type { OnRenderHtmlAsync } from 'vike/types'
import {
  getAssetPath,
  getInlineRuntimeSource,
  getIslandsComponentAssets,
  getUsedIslandNames,
  hasIslands,
  joinAssetPath,
  renderDocumentHtml,
  serializeIslandsClientConfig,
  type ViteManifest,
  findManifestEntry,
} from '../core/onRenderHtmlCommon'

const ISLANDS_REACT_RUNTIME_PUBLIC_ID = '/@vike-islands/react-runtime'
const ISLANDS_REACT_RUNTIME_NAME = 'vike-islands-react-runtime'

function getInlineIslandsClientScript(): string {
  return [
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
  ].join('\n')
}

const onRenderHtml: OnRenderHtmlAsync = async (pageContext): ReturnType<OnRenderHtmlAsync> => {
  const Page = pageContext.config.Page as any
  const layouts = ((pageContext.config as any).Layout ?? []) as any[]

  let tree: any = React.createElement(Page, pageContext.routeParams ?? {})
  for (const Layout of [...layouts].reverse()) {
    tree = React.createElement(Layout, null, tree)
  }

  const html = renderToString(tree)
  const islandNames = hasIslands(html) ? getUsedIslandNames(html) : []
  const components = islandNames.length > 0
    ? getIslandsComponentAssets(pageContext, islandNames)
    : {}
  const globalContext = (pageContext as any)._globalContext
  const baseAssets = globalContext?.baseAssets ?? ''
  const isProduction = globalContext?._isProduction ?? !!globalContext?.assetsManifest
  const reactRuntime = !isProduction
    ? joinAssetPath(baseAssets, ISLANDS_REACT_RUNTIME_PUBLIC_ID)
    : getAssetPath(pageContext, findManifestEntry(globalContext?.assetsManifest as ViteManifest, (entry) => (
      !!entry.isEntry &&
      (entry.name === ISLANDS_REACT_RUNTIME_NAME || entry.src === 'vike-islands:react-runtime')
    )))
  const islandsClientConfig = reactRuntime && Object.keys(components).length > 0
    ? serializeIslandsClientConfig({ reactRuntime, components })
    : null
  const islandsInlineClientScript = islandsClientConfig
    ? getInlineIslandsClientScript().replace(/<\/script/gi, '<\\/script')
    : null

  const title = (pageContext.config as any).title ?? ''
  const description = (pageContext.config as any).description ?? ''
  const lang = (pageContext.config as any).lang ?? 'en'
  const favicon = (pageContext.config as any).favicon ?? ''

  return {
    documentHtml: renderDocumentHtml({
      html,
      title,
      description,
      lang,
      favicon,
      islandsClientConfig,
      islandsInlineClientScript,
    }),
    pageContext: {},
  }
}

export { onRenderHtml }
