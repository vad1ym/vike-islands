import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { escapeInject, dangerouslySkipEscape } from 'vike/server'

const require = createRequire(import.meta.url)

export type ViteManifestEntry = {
  src?: string
  file: string
  isEntry?: boolean
  name?: string
}

export type ViteManifest = Record<string, ViteManifestEntry>

export function hasIslands(html: string): boolean {
  return html.includes('data-island=')
}

export function getUsedIslandNames(html: string): string[] {
  const names = new Set<string>()
  const matches = html.matchAll(/\sdata-island="([^"]+)"/g)
  for (const match of matches) names.add(match[1])
  return [...names]
}

export function joinAssetPath(base: string, pathname: string): string {
  if (!base || base === '/') return pathname
  return `${base.replace(/\/+$/, '')}/${pathname.replace(/^\/+/, '')}`
}

export function findManifestEntry(assetsManifest: ViteManifest, predicate: (entry: ViteManifestEntry) => boolean): ViteManifestEntry | null {
  return Object.values(assetsManifest).find((entry): entry is ViteManifestEntry => !!entry && predicate(entry)) ?? null
}

export function getAssetPath(pageContext: any, manifestEntry: ViteManifestEntry | null): string | null {
  if (!manifestEntry) return null
  const globalContext = pageContext?._globalContext
  const baseAssets = globalContext?.baseAssets ?? ''
  return joinAssetPath(baseAssets, `/${manifestEntry.file}`)
}

export function getIslandsComponentAssets(pageContext: any, islandNames: string[]): Record<string, string> {
  const globalContext = pageContext?._globalContext
  const baseAssets = globalContext?.baseAssets ?? ''
  const isProduction = globalContext?._isProduction ?? !!globalContext?.assetsManifest

  if (!isProduction) {
    return Object.fromEntries(
      islandNames.map((name) => [name, joinAssetPath(baseAssets, `/@vike-islands/component/${name}`)]),
    )
  }

  const assetsManifest = globalContext?.assetsManifest as ViteManifest | undefined
  if (!assetsManifest) return {}

  return Object.fromEntries(
    islandNames.flatMap((name) => {
      const entry = findManifestEntry(assetsManifest, (manifestEntry) => (
        !!manifestEntry.isEntry &&
        manifestEntry.src === `vike-islands:component:${name}`
      ))
      const assetPath = getAssetPath(pageContext, entry)
      return assetPath ? [[name, assetPath]] : []
    }),
  )
}

export function serializeIslandsClientConfig(config: Record<string, unknown>): string {
  return JSON.stringify(config).replace(/</g, '\\u003c')
}

export function getPackageDistFilePath(importMetaUrl: string, filename: string): string {
  const pluginFile = createRequire(importMetaUrl).resolve('vike-islands/plugin')
  return path.join(path.dirname(pluginFile), filename)
}

export function getInlineRuntimeSource(importMetaUrl: string, filename: string): string {
  const runtimeSource = fs.readFileSync(getPackageDistFilePath(importMetaUrl, filename), 'utf8')
  return runtimeSource.replace(/\n?export\s*\{[^}]+\};?\s*$/m, '\n')
}

export function getClientOutDir(pageContext: any, importMetaUrl: string): string {
  const globalContext = pageContext?._globalContext
  const viteConfigRuntime =
    globalContext?._viteConfigRuntime ??
    globalContext?.viteConfigRuntime ??
    globalContext?._buildInfo?.viteConfigRuntime
  const outDir = viteConfigRuntime?.build?.outDir
  if (typeof outDir === 'string' && outDir.length > 0) {
    return path.join(outDir, 'client')
  }
  return path.resolve(path.dirname(createRequire(importMetaUrl).resolve('vike-islands/plugin')), '..', 'examples', 'vue', 'dist', 'client')
}

export function renderDocumentHtml(args: {
  html: string
  title?: string
  description?: string
  lang?: string
  favicon?: string
  islandsClientConfig?: string | null
  islandsInlineClientScript?: string | null
}) {
  const {
    html,
    title = '',
    description = '',
    lang = 'en',
    favicon = '',
    islandsClientConfig = null,
    islandsInlineClientScript = null,
  } = args

  return escapeInject`<!DOCTYPE html>
<html lang="${lang}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    ${title ? escapeInject`<title>${title}</title>` : ''}
    ${description ? escapeInject`<meta name="description" content="${description}" />` : ''}
    ${favicon ? escapeInject`<link rel="icon" href="${favicon}" />` : ''}
  </head>
  <body>
    <div id="app">${dangerouslySkipEscape(html)}</div>
    ${islandsClientConfig ? escapeInject`<script>window.__VIKE_ISLANDS__=${dangerouslySkipEscape(islandsClientConfig)}</script>` : ''}
    ${islandsInlineClientScript ? escapeInject`<script type="module">${dangerouslySkipEscape(islandsInlineClientScript)}</script>` : ''}
  </body>
</html>`
}
