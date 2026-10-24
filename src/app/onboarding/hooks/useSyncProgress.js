import { useEffect, useState } from "react"
import { apiRequest } from "@/lib/api"

// Progress for the corner badge while the first client's history syncs.
export function useSyncProgress({ syncing, firstGroupId, selectedAd }) {
  const [syncGhlPct, setSyncGhlPct] = useState(0)
  const [syncMetaPct, setSyncMetaPct] = useState(0)

  useEffect(() => {
    if (!syncing) return
    let cancelled = false
    const poll = async () => {
      if (cancelled) return
      if (!firstGroupId) {
        // Creation request still running server-side (it blocks on the GHL
        // fetch) — show honest-but-approximate movement until it resolves.
        setSyncGhlPct((p) => Math.min(90, p + 3 + Math.round(Math.random() * 5)))
        setSyncMetaPct((p) => Math.min(25, p + 1 + Math.round(Math.random() * 3)))
        return
      }
      try {
        const res = await apiRequest(`/api/client-groups/${firstGroupId}/refresh-status`)
        if (!res.ok) return
        const d = await res.json()
        // The creation endpoint awaits the GHL fetch, so once the group id
        // exists GHL history is in unless a refresh is actively running.
        setSyncGhlPct(d.ghl_refresh_status === "running" ? 60 : 100)
        const p = d.meta_refresh_progress
        if (!p) {
          setSyncMetaPct(selectedAd ? 30 : 100)
        } else if (p.status === "success" || p.current_step === "done") {
          setSyncMetaPct(100)
        } else {
          const presetPct = p.presets_total ? Math.round((p.presets_done / p.presets_total) * 85) : 10
          setSyncMetaPct(Math.min(95, presetPct + (p.leads_status === "success" ? 10 : 0)))
        }
      } catch { /* transient — keep last values */ }
    }
    const timer = setInterval(poll, firstGroupId ? 4000 : 900)
    poll()
    return () => { cancelled = true; clearInterval(timer) }
  }, [syncing, firstGroupId, selectedAd])

  return { syncGhlPct, syncMetaPct }
}
