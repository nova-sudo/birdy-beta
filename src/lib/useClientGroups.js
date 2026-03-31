import { useState, useEffect, useCallback, useRef } from "react"
import { apiRequest } from "./api"
import { getCachedData, setCachedData, clearCache } from "./cache"
import { CACHE_KEYS, DEFAULT_DATE_PRESET } from "./constants"

function cacheKey(preset) {
  return `${CACHE_KEYS.CLIENT_GROUPS}_${preset}`
}

export function useClientGroups(initialPreset = DEFAULT_DATE_PRESET) {
  const [datePreset, setDatePreset] = useState(initialPreset)
  const [clientGroups, setClientGroups] = useState([])
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [hasIncompleteGroups, setHasIncompleteGroups] = useState(false)
  const abortRef = useRef(null)
  const pollingRef = useRef(null)

  const fetchGroups = useCallback(async (preset, forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = getCachedData(cacheKey(preset))
      if (cached) {
        setClientGroups(cached.groups || cached)
        setMeta(cached.meta || null)
        setLoading(false)
        setError(null)
        return
      }
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)

    try {
      const res = await apiRequest(
        `/api/client-groups?date_preset=${preset}`,
        { signal: controller.signal }
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data = await res.json()
      const groups = data.client_groups || []
      const responseMeta = data.meta || null

      // Only cache when all groups are fully loaded
      const hasIncomplete = groups.some(g => g.status === "creating" || g.status === "pending")
      if (!hasIncomplete) {
        setCachedData(cacheKey(preset), { groups, meta: responseMeta })
      }
      setHasIncompleteGroups(hasIncomplete)

      setClientGroups(groups)
      setMeta(responseMeta)
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(err.message)
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }
  }, [])

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
