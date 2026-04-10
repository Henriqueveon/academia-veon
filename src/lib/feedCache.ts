// Persistent feed cache (localStorage) — instant load on revisit, like Instagram
const KEY_PREFIX = 'feed-cache-v1:'
const MAX_AGE_MS = 1000 * 60 * 60 * 24 // 24h

interface CacheEntry<T> {
  data: T
  timestamp: number
}

export function saveCache<T>(key: string, data: T) {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() }
    localStorage.setItem(KEY_PREFIX + key, JSON.stringify(entry))
  } catch {
    // Storage full or unavailable — ignore
  }
}

export function loadCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + key)
    if (!raw) return null
    const entry: CacheEntry<T> = JSON.parse(raw)
    if (Date.now() - entry.timestamp > MAX_AGE_MS) {
      localStorage.removeItem(KEY_PREFIX + key)
      return null
    }
    return entry.data
  } catch {
    return null
  }
}

export function clearCache(key: string) {
  try {
    localStorage.removeItem(KEY_PREFIX + key)
  } catch {}
}
