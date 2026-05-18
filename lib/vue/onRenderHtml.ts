import fs from 'node:fs'
import path from 'node:path'
import { createSSRApp, h } from 'vue'
import type { Component } from 'vue'
import { renderToString } from 'vue/server-renderer'
import type { OnRenderHtmlAsync } from 'vike/types'
import {
  findManifestEntry,
  getClientOutDir,
  getInlineRuntimeSource,
  getIslandsComponentAssets,
  getUsedIslandNames,
  hasIslands,
  joinAssetPath,
  renderDocumentHtml,
  serializeIslandsClientConfig,
  type ViteManifest,
} from '../core/onRenderHtmlCommon'

const ISLANDS_VUE_RUNTIME_NAME = 'vike-islands-vue-runtime'

function getVueRuntimeLoaderSource(pageContext: OnRenderHtmlAsync extends (pageContext: infer T) => any ? T : never): string {
  const globalContext = (pageContext as any)._globalContext
  const baseAssets = globalContext?.baseAssets ?? ''
  const isProduction = globalContext?._isProduction ?? !!globalContext?.assetsManifest

  if (!isProduction) {
    const vueUrl = joinAssetPath(baseAssets, '/@id/vue')
    return [
      `const __vike_islands_load_vue = async () => {`,
      `  const mod = await importByUrl(${JSON.stringify(vueUrl)})`,
      `  return { createApp: mod.createApp, h: mod.h }`,
      `}`,
    ].join('\n')
  }

  const assetsManifest = globalContext?.assetsManifest as ViteManifest | undefined
  if (!assetsManifest) {
    throw new Error('[vike-islands] Missing assets manifest for production Vue runtime resolution.')
  }

  const wrapperEntry = findManifestEntry(assetsManifest, (entry) => (
    !!entry.isEntry &&
    (entry.name === ISLANDS_VUE_RUNTIME_NAME || entry.src === 'vike-islands:vue-runtime')
  ))
  if (!wrapperEntry?.file) {
    throw new Error('[vike-islands] Vue runtime wrapper asset not found in manifest.')
  }

  const wrapperFile = path.join(getClientOutDir(pageContext, import.meta.url), wrapperEntry.file)
  const wrapperSource = fs.readFileSync(wrapperFile, 'utf8').trim()
  const importMatch = wrapperSource.match(/import\{([^}]+)\}from["'](.+?)["'];?/)
  const objectMatch = wrapperSource.match(/createApp:([A-Za-z_$][\w$]*),h:([A-Za-z_$][\w$]*)/)

  if (!importMatch || !objectMatch) {
    throw new Error('[vike-islands] Unexpected Vue runtime wrapper format.')
  }

  const importSpecifiers = importMatch[1]
    .split(',')
    .map((part: string) => part.trim())
    .filter(Boolean)
  const importPath = importMatch[2]
  const createAppLocal = objectMatch[1]
  const hLocal = objectMatch[2]
  const localToImported = new Map<string, string>()

  for (const specifier of importSpecifiers) {
    const aliasMatch = specifier.match(/^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/)
    if (aliasMatch) {
      localToImported.set(aliasMatch[2], aliasMatch[1])
    } else {
      localToImported.set(specifier, specifier)
    }
  }

  const createAppImport = localToImported.get(createAppLocal)
  const hImport = localToImported.get(hLocal)
  if (!createAppImport || !hImport) {
    throw new Error('[vike-islands] Failed to resolve Vue runtime exports from wrapper.')
  }

  const absoluteImportPath = joinAssetPath(baseAssets, `/${path.posix.join('assets', importPath.replace(/^\.\//, ''))}`)
  return [
    `const __vike_islands_load_vue = async () => {`,
    `  const mod = await importByUrl(${JSON.stringify(absoluteImportPath)})`,
    `  return { createApp: mod.${createAppImport}, h: mod.${hImport} }`,
    `}`,
  ].join('\n')
}

function getInlineIslandsClientScript(pageContext: OnRenderHtmlAsync extends (pageContext: infer T) => any ? T : never): string {
  return [
    getInlineRuntimeSource(import.meta.url, 'runtime-vue.js'),
    `const config = window.__VIKE_ISLANDS__`,
    `const importByUrl = new Function("u", "return import(u)")`,
    getVueRuntimeLoaderSource(pageContext),
    `if (config) {`,
    `  const loaders = Object.fromEntries(`,
    `    Object.entries(config.components).map(([name, url]) => [name, () => importByUrl(url).then((mod) => mod.default)]),`,
    `  )`,
    `  hydrateIslands({`,
    `    loaders,`,
    `    loadVueRuntime: __vike_islands_load_vue,`,
    `  })`,
    `}`,
  ].join('\n')
}

const onRenderHtml: OnRenderHtmlAsync = async (pageContext): ReturnType<OnRenderHtmlAsync> => {
  const Page = pageContext.config.Page as Component
  const layouts = ((pageContext.config as any).Layout ?? []) as Component[]

  let root = () => h(Page, pageContext.routeParams ?? {})
  for (const Layout of layouts) {
    const inner = root
    root = () => h(Layout, null, { default: inner })
  }

  const app = createSSRApp({ render: root })
  const html = await renderToString(app)
  const islandNames = hasIslands(html) ? getUsedIslandNames(html) : []
  const islandsComponentSrc = islandNames.length > 0
    ? getIslandsComponentAssets(pageContext, islandNames)
    : {}
  const islandsClientConfig = Object.keys(islandsComponentSrc).length > 0
    ? serializeIslandsClientConfig({ components: islandsComponentSrc })
    : null
  const islandsInlineClientScript = islandsClientConfig
    ? getInlineIslandsClientScript(pageContext).replace(/<\/script/gi, '<\\/script')
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
