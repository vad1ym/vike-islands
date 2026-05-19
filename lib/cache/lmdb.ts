import type { IslandCacheAdapter, CacheEntry } from '../core/cache'

export interface LmdbCacheOptions {
  /** Path to the LMDB directory. Defaults to '.vike-islands-cache' */
  path?: string
}

export function createLmdbCache(options: LmdbCacheOptions = {}): IslandCacheAdapter {
  const dbPath = options.path ?? '.vike-islands-cache'
  let dbPromise: Promise<import('lmdb').RootDatabase<CacheEntry, string>> | null = null

  function getDb(): Promise<import('lmdb').RootDatabase<CacheEntry, string>> {
    if (!dbPromise) {
      dbPromise = import('lmdb').then(({ open }) => open<CacheEntry, string>({ path: dbPath, encoding: 'msgpack' }))
    }
    return dbPromise
  }

  return {
    async get(key: string): Promise<string | null> {
      const db = await getDb()
      const entry = db.get(key)
      if (!entry) return null
      if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
        db.remove(key)
        return null
      }
      return entry.html
    },

    async set(key: string, html: string, ttl?: number): Promise<void> {
      const db = await getDb()
      const expiresAt = ttl !== undefined ? Date.now() + ttl * 1000 : null
      await db.transaction(() => db.put(key, { html, expiresAt }))
    },
  }
}
