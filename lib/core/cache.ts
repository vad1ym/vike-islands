export interface IslandCacheAdapter {
  get(key: string): Promise<string | null>
  set(key: string, html: string, ttl?: number): Promise<void>
}

export interface CacheEntry {
  html: string
  expiresAt: number | null  // null = no expiry, unix ms
}

export function makeCacheKey(islandName: string, explicitKey: string): string {
  return `island:${islandName}:${explicitKey}`
}
