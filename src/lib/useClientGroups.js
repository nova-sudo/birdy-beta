import { useState, useEffect, useCallback, useRef } from "react"
import { apiRequest } from "./api"
import { getCachedData, setCachedData, clearCache } from "./cache"
import { CACHE_KEYS, DEFAULT_DATE_PRESET } from "./constants"

// The variant is part of the key, not just the preset.
//
// /clients asks for include_daily=false, everyone else asks for the full
// payload. Sharing one key meant the two overwrote each other: open the
// Client Hub, then the Lead or Sales Hub, and the hub read back a cached
// payload with no ghl_daily_leads / meta_daily_spend / hp_daily_calls. Those
// series are exactly what its KPI tiles and trend chart sum, so it painted
// zeroes — and with `loading` already false, they read as finished figures.
// Changing the date preset was the only way out, because that was the only
// thing that moved the key.
function cacheKey(preset, includeDaily) {
  return `${CACHE_KEYS.CLIENT_GROUPS}_${preset}_${includeDaily ? "full" : "lite"}`
}

/**
 * @param {string} initialPreset
 * @param {object} [opts]
 * @param {boolean} [opts.includeDaily] fetch the per-day series too.
 *
 * The daily series — `gohighlevel.daily_leads`, `facebook.daily_spend`,
 * `hotprospector.daily_calls` — are only read by the hubs that draw trend
 * charts. They were served to every caller regardless: 6.38 MB across 67
 * groups (3.79 leads + 2.39 spend + 0.20 calls), most of it going to pages
 * that never touch it. The Clients page alone carried 3.79 MB of lead history
 * it does not plot.
 *
 * ON by default. The saving comes from the pages that do not chart them
 * opting OUT — Clients and alerts — not from every other page having to
 * remember to opt in.
 *
 * It shipped defaulting to off, and that was wrong: any caller unaware of the
 * option silently lost its data. The Lead Hub rendered 0 leads while its own
 * table, served by a different endpoint, showed 1,459. A missing option should
 * cost a caller a bigger payload, never a wrong number.
 */
export function useClientGroups(initialPreset = DEFAULT_DATE_PRESET, opts = {}) {
  const { includeDaily = true } = opts
  const [datePreset, setDatePreset] = useState(initialPreset)
  const [clientGroups, setClientGroups] = useState([])
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [hasIncompleteGroups, setHasIncompleteGroups] = useState(false)
  const abortRef = useRef(null)
  const pollingRef = useRef(null)

  const fetchGroups = useCallback(async (preset, forceRefresh = false) => {
    // Stale-while-revalidate. The cache used to be a hard short-circuit: it
    // painted and returned, so an entry written while HotProspector was
    // mid-sync served zeroes — with `loading` already false, so they read as
    // finished figures — for the full hour of its TTL. Clearing localStorage
    // was the only way out. Now the cache still paints immediately, but the
    // request goes out behind it and corrects the numbers when it lands.
    let servedFromCache = false
    if (!forceRefresh) {
      const cached = getCachedData(cacheKey(preset, includeDaily))
      if (cached) {
        setClientGroups(cached.groups || cached)
        setMeta(cached.meta || null)
        setLoading(false)
        setError(null)
        servedFromCache = true
      }
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    // Only show the loading state when there is nothing on screen yet;
    // revalidating behind cached figures must not blank them.
    if (!servedFromCache) setLoading(true)
    setError(null)

    try {
      const res = await apiRequest(
        `/api/client-groups?date_preset=${preset}`
          + (includeDaily ? "" : "&include_daily=false"),
        { signal: controller.signal }
      )
      if (!res.ok) {
        // Try to extract a meaningful error message from the response
        let detail = `HTTP ${res.status}`
        try {
          const body = await res.json()
          detail = body.detail || body.error || detail
        } catch {}
        const err = new Error(detail)
        err.status = res.status
        throw err
      }

      const data = await res.json()
      const groups = data.client_groups || []
      const responseMeta = data.meta || null

      // Only cache when all groups are fully loaded
      const hasIncomplete = groups.some(g => g.status === "creating" || g.status === "pending")
      if (!hasIncomplete) {
        setCachedData(cacheKey(preset, includeDaily), { groups, meta: responseMeta })
      }
      setHasIncompleteGroups(hasIncomplete)

      setClientGroups(groups)
      setMeta(responseMeta)
    } catch (err) {
      // A failed revalidation leaves the cached figures on screen rather than
      // replacing them with an error — they are stale, not wrong.
      if (err.name !== "AbortError" && !servedFromCache) {
        setError(err.message)
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }
    // includeDaily is fixed per call site today, but leaving it out of the
    // deps would capture the first render's value — a stale closure waiting
    // for the first caller that toggles it.
  }, [includeDaily])

  useEffect(() => {
    fetchGroups(datePreset)
    return () => abortRef.current?.abort()
  }, [datePreset, fetchGroups])

  // Poll every 10s while any group is still creating/pending
  useEffect(() => {
    if (hasIncompleteGroups) {
      pollingRef.current = setInterval(() => {
        fetchGroups(datePreset, true)
      }, 10000)
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [hasIncompleteGroups, datePreset, fetchGroups])

  const invalidate = useCallback(() => {
    clearCache(CACHE_KEYS.CLIENT_GROUPS)
    fetchGroups(datePreset, true)
  }, [datePreset, fetchGroups])

  const refresh = useCallback(() => {
    fetchGroups(datePreset, true)
  }, [datePreset, fetchGroups])

  return {
    clientGroups,
    meta,
    loading,
    error,
    datePreset,
    setDatePreset,
    invalidate,
    refresh,
  }
}
