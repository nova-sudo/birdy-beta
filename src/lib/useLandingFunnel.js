"use client"

/**
 * The landing-page funnel for one client over one date preset.
 *
 * Its own hook rather than another field on the client-groups payload, because
 * it is scoped to a single client and a single window: folding it into the
 * cached group document would make every hub that lists clients pay for a
 * figure only the two single-client screens draw.
 *
 * `applicable: false` is a real, successful answer — it means this client has
 * no landing page of ours to measure — so it is returned as data rather than
 * raised. The card renders nothing for it. See components/attribution/LandingFunnel.
 */

import { useCallback, useEffect, useState } from "react"

import { apiRequest } from "@/lib/api"
import { presetToStartEnd } from "@/lib/date-utils"

export function useLandingFunnel(groupId, datePreset) {
  const [funnel, setFunnel] = useState(null)
  const [loading, setLoading] = useState(Boolean(groupId))
  const [error, setError] = useState(null)

  const load = useCallback(
    async (signal) => {
      if (!groupId) {
        setFunnel(null)
        setLoading(false)
        return
      }

      const { start, end } = presetToStartEnd(datePreset)
      setLoading(true)
      try {
        const res = await apiRequest(
          `/attribution/funnel/${encodeURIComponent(groupId)}?start=${start}&end=${end}`,
          { signal }
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (signal?.aborted) return
        setFunnel(data)
        setError(null)
      } catch (e) {
        if (signal?.aborted || e?.name === "AbortError") return
        // A funnel that fails to load hides itself rather than pushing an
        // error banner onto a screen whose other twelve figures are fine.
        console.warn("[landing-funnel] Could not load:", e)
        setFunnel(null)
        setError(e)
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [groupId, datePreset]
  )

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  return { funnel, loading, error, refresh: () => load() }
}
