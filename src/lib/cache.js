import { CACHE_DURATION } from "./constants"

/**
 * Read cached data from localStorage with TTL check.
 * Returns null if cache is missing or expired.
 */
export function getCachedData(key) {
  try {
    const cached = localStorage.getItem(key)
    if (!cached) return null

    const { data, timestamp } = JSON.parse(cached)
    const now = Date.now()
    // Support prefixed keys: "clientGroups_last_7d" → lookup "clientGroups"
    const baseKey = key.includes("_") ? key.substring(0, key.indexOf("_")) : key
    const maxAge = CACHE_DURATION[key] || CACHE_DURATION[baseKey] || 5 * 60 * 1000

    if (now - timestamp < maxAge) {
      return data
    }

    localStorage.removeItem(key)
    return null
  } catch {
    return null
  }
}

/**
 * Write data to localStorage with a timestamp for TTL.
 */
export function setCachedData(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }))
  } catch {
    // Storage full or unavailable — silently fail
  }
}

/**
 * Clear all localStorage keys matching a pattern.
 */
export function clearCache(pattern) {
  try {
    Object.keys(localStorage).forEach((key) => {
      if (key.includes(pattern)) {
        localStorage.removeItem(key)
      }
    })
  } catch {
    // Silently fail
  }
}
