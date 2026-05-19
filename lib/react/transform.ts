const ISLAND_IMPORT = `import { Island as __VikeIsland__ } from 'vike-islands/react'`

// Matches self-closing JSX: <ComponentName ...props />
const JSX_SELF_CLOSING = /<([A-Z][A-Za-z0-9.]*)((?:\s+(?:[A-Za-z][A-Za-z0-9:.-]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|\{(?:[^{}]|\{[^{}]*\})*\}))?))*)(\s*\/>)/g

function getIslandImports(code: string): Set<string> {
  const names = new Set<string>()
  const pattern = /import\s+(\w+)\s+from\s+['"][^'"]+\?island['"]/g
  let m: RegExpExecArray | null
  while ((m = pattern.exec(code)) !== null) names.add(m[1])
  return names
}

// Parse client:{mode}, server:cache="{ttl}", server:cache-key="{key}" from attrs string
function parseIslandAttrs(attrsStr: string): { hydrate: string; cache?: number; cacheKey?: string; cleanedAttrs: string } {
  let hydrate = 'load'
  let cache: number | undefined
  let cacheKey: string | undefined
  let cleanedAttrs = attrsStr

  const clientMatch = cleanedAttrs.match(/\s+client:(\w+)\b/)
  if (clientMatch) {
    hydrate = clientMatch[1]
    cleanedAttrs = cleanedAttrs.replace(/\s+client:\w+\b/, '')
  }

  const cacheMatch = cleanedAttrs.match(/\s+server:cache=(?:"(\d+)"|'(\d+)'|\{(\d+)\})/)
  if (cacheMatch) {
    cache = Number(cacheMatch[1] ?? cacheMatch[2] ?? cacheMatch[3])
    cleanedAttrs = cleanedAttrs.replace(/\s+server:cache=(?:"[^"]*"|'[^']*'|\{[^}]*\})/, '')
  }

  const cacheKeyMatch = cleanedAttrs.match(/\s+server:cache-key=(?:"([^"]*)"|'([^']*)')/)
  if (cacheKeyMatch) {
    cacheKey = cacheKeyMatch[1] ?? cacheKeyMatch[2]
    cleanedAttrs = cleanedAttrs.replace(/\s+server:cache-key=(?:"[^"]*"|'[^']*')/, '')
  }

  return { hydrate, cache, cacheKey, cleanedAttrs }
}

export function reactTransformHook(code: string, id: string): string | null | undefined {
  if (!id.endsWith('.tsx') && !id.endsWith('.jsx')) return
  if (!code.includes('?island')) return
  if (code.includes('__VikeIsland__')) return

  const islandComponents = getIslandImports(code)
  if (islandComponents.size === 0) return null

  let transformed = code
  let hasAnyIsland = false

  transformed = transformed.replace(JSX_SELF_CLOSING, (match, tag, attrsStr, _closing) => {
    if (!islandComponents.has(tag)) return match

    hasAnyIsland = true
    const { hydrate, cache, cacheKey, cleanedAttrs } = parseIslandAttrs(attrsStr)
    const cacheAttr = cache !== undefined ? ` cache={${cache}}` : ''
    const cacheKeyAttr = cacheKey !== undefined ? ` cacheKey="${cacheKey}"` : ''

    return `<__VikeIsland__ name="${tag}" component={${tag}} hydrate="${hydrate}"${cacheAttr}${cacheKeyAttr}${cleanedAttrs} />`
  })

  if (!hasAnyIsland) return null

  if (!transformed.includes(ISLAND_IMPORT)) {
    transformed = `${ISLAND_IMPORT}\n${transformed}`
  }

  return transformed
}
