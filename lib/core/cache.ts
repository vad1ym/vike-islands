export interface IslandCacheAdapter {
  get(key: string): Promise<string | null>
  set(key: string, html: string, ttl?: number): Promise<void>
}

export interface CacheEntry {
  html: string
  expiresAt: number | null  // null = no expiry, unix ms
}

export function makeCacheKey(islandName: string, props: Record<string, unknown>): string {
  const raw = `island:${islandName}:${stableStringify(props)}`
  return raw.length > 200 ? `island:${islandName}:${hashString(raw)}` : raw
}

function hashString(str: string): string {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0
  }
  return h.toString(36)
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const sorted = Object.keys(value as object).sort()
  return `{${sorted.map((k) => `${JSON.stringify(k)}:${stableStringify((value as any)[k])}`).join(',')}}`
}
