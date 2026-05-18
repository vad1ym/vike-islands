import fs from 'node:fs'
import path from 'node:path'
import { onRenderHtml as vikeVueOnRenderHtml } from 'vike-vue/__internal/integration/onRenderHtml'
import { dangerouslySkipEscape } from 'vike/server'
import type { OnRenderHtmlAsync } from 'vike/types'
import {
  findManifestEntry,
  getClientOutDir,
  getInlineRuntimeSource,
  getIslandsComponentAssets,
  getUsedIslandNames,
  hasIslands,
  joinAssetPath,
  serializeIslandsClientConfig,
  type ViteManifest,
} from '../core/onRenderHtmlCommon'

type PageContext = OnRenderHtmlAsync extends (pageContext: infer T) => any ? T : never

const ISLANDS_VUE_RUNTIME_NAME = 'vike-islands-vue-runtime'

function getVueRuntimeLoaderSource(pageContext: PageContext): string {
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
  if (!assetsManifest) throw new Error('[vike-islands] Missing assets manifest.')

  const wrapperEntry = findManifestEntry(assetsManifest, (entry) => (
    !!entry.isEntry &&
    (entry.name === ISLANDS_VUE_RUNTIME_NAME || entry.src === 'vike-islands:vue-runtime')
  ))
  if (!wrapperEntry?.file) throw new Error('[vike-islands] Vue runtime wrapper asset not found in manifest.')

  const wrapperFile = path.join(getClientOutDir(pageContext, import.meta.url), wrapperEntry.file)
  const wrapperSource = fs.readFileSync(wrapperFile, 'utf8').trim()
  const importMatch = wrapperSource.match(/import\{([^}]+)\}from["'](.+?)["'];?/)
  const objectMatch = wrapperSource.match(/createApp:([A-Za-z_$][\w$]*),h:([A-Za-z_$][\w$]*)/)

  if (!importMatch || !objectMatch) throw new Error('[vike-islands] Unexpected Vue runtime wrapper format.')

  const importSpecifiers = importMatch[1].split(',').map((s: string) => s.trim()).filter(Boolean)
  const importPath = importMatch[2]
  const localToImported = new Map<string, string>()
  for (const specifier of importSpecifiers) {
    const aliasMatch = specifier.match(/^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/)
    if (aliasMatch) localToImported.set(aliasMatch[2], aliasMatch[1])
    else localToImported.set(specifier, specifier)
  }

  const createAppImport = localToImported.get(objectMatch[1])
  const hImport = localToImported.get(objectMatch[2])
  if (!createAppImport || !hImport) throw new Error('[vike-islands] Failed to resolve Vue runtime exports.')

  const absoluteImportPath = joinAssetPath(baseAssets, `/${path.posix.join('assets', importPath.replace(/^\.\//, ''))}`)
  return [
    `const __vike_islands_load_vue = async () => {`,
    `  const mod = await importByUrl(${JSON.stringify(absoluteImportPath)})`,
    `  return { createApp: mod.${createAppImport}, h: mod.${hImport} }`,
    `}`,
  ].join('\n')
}

function buildIslandsInjection(pageContext: PageContext, html: string): string | null {
  const islandNames = hasIslands(html) ? getUsedIslandNames(html) : []
  const islandsComponentSrc = islandNames.length > 0
    ? getIslandsComponentAssets(pageContext, islandNames)
    : {}
  if (Object.keys(islandsComponentSrc).length === 0) return null

  const islandsClientConfig = serializeIslandsClientConfig({ components: islandsComponentSrc })
  const inlineScript = [
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
  ].join('\n').replace(/<\/script/gi, '<\\/script')

  return [
    `<script>window.__VIKE_ISLANDS__=${islandsClientConfig}</script>`,
    `<script type="module">${inlineScript}</script>`,
  ].join('\n')
}

function extractHtmlString(node: any): string {
  if (!node || typeof node !== 'object') return String(node ?? '')
  if (typeof node._escaped === 'string') return node._escaped
  if (node._template) {
    const { templateStrings, templateVariables } = node._template
    let result = ''
    for (let i = 0; i < templateStrings.length; i++) {
      result += templateStrings[i]
      if (i < templateVariables.length) result += extractHtmlString(templateVariables[i])
    }
    return result
  }
  return ''
}

export const onRenderHtml: OnRenderHtmlAsync = async (pageContext) => {
  const result = await vikeVueOnRenderHtml(pageContext)

  // Extract HTML string from documentHtml to scan for islands
  const documentHtml = (result as any).documentHtml
  const htmlString = extractHtmlString(documentHtml)

  const injection = buildIslandsInjection(pageContext, htmlString)
  if (!injection) return result

  const patched = htmlString.replace('</body>', `${injection}\n</body>`)
  return {
    ...result,
    documentHtml: dangerouslySkipEscape(patched),
  }
}
