import { useState, useEffect } from "react"
import { toast } from "sonner"
import { apiRequest } from "@/lib/api"
import { STRICTNESS_OPTIONS } from "./constants"

// General tab state: the per-user agent capability switches and the
// suggestion strictness that sits under the Media Buying Analyst one.
export function useCapabilities() {
  // ── Agent capabilities (Settings → General) ────────────────────────────
  // Per-user Birdy agent ability toggles, persisted server-side via
  // /api/capabilities. `capsLoaded` gates the switches until the real values
  // arrive so we don't flash a default-off state over an enabled capability.
  const [capabilities, setCapabilities] = useState({ media_buying: false })
  const [capsLoaded, setCapsLoaded] = useState(false)
  const [savingCapability, setSavingCapability] = useState(null) // capability key mid-save
  // Suggestion strictness, shown under the Media Buying Analyst switch.
  // Stored per account by /api/dashboard/settings; "balanced" when unset.
  const [strictness, setStrictness] = useState("balanced")
  const [strictnessLoaded, setStrictnessLoaded] = useState(false)
  const [savingStrictness, setSavingStrictness] = useState(false)

  // Load the user's capability flags for the General tab's Agent Capabilities block.
  useEffect(() => {
    apiRequest("/api/capabilities")
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setCapabilities(prev => ({ ...prev, ...data })) })
      .catch(() => {})
      .finally(() => setCapsLoaded(true))
  }, [])

  useEffect(() => {
    apiRequest("/api/dashboard/settings")
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.strictness) setStrictness(data.strictness) })
      .catch(() => {})
      .finally(() => setStrictnessLoaded(true))
  }, [])

  const changeStrictness = async (next) => {
    const previous = strictness
    setStrictness(next)
    setSavingStrictness(true)
    try {
      const res = await apiRequest("/api/dashboard/settings", {
        method: "PUT",
        body: JSON.stringify({ strictness: next }),
      })
      if (!res.ok) throw new Error("Failed to save strictness")
      const label = STRICTNESS_OPTIONS.find(o => o.value === next)?.label ?? next
      toast.success(`Suggestions set to ${label.replace(" (default)", "")}`, {
        description: "Birdy's next suggestion pass will use it.",
      })
    } catch {
      setStrictness(previous)
      toast.error("Couldn't update strictness", { description: "Please try again." })
    } finally {
      setSavingStrictness(false)
    }
  }

  // Toggle a capability with optimistic UI + revert on failure. The backend
  // returns the full resolved set, so we reconcile against its response.
  const toggleCapability = async (key, next) => {
    const previous = capabilities[key]
    setCapabilities(c => ({ ...c, [key]: next }))
    setSavingCapability(key)
    try {
      const res = await apiRequest("/api/capabilities", {
        method: "PUT",
        body: JSON.stringify({ [key]: next }),
      })
      if (!res.ok) throw new Error("Failed to save capability")
      const data = await res.json()
      setCapabilities(c => ({ ...c, ...data }))
      toast.success(next ? "Capability enabled" : "Capability disabled", {
        description: "New Birdy chats will use this setting.",
      })
    } catch (err) {
      setCapabilities(c => ({ ...c, [key]: previous })) // revert optimistic change
      toast.error("Couldn't update capability", { description: "Please try again." })
    } finally {
      setSavingCapability(null)
    }
  }

  return {
    capabilities,
    capsLoaded,
    savingCapability,
    toggleCapability,
    strictness,
    strictnessLoaded,
    savingStrictness,
    changeStrictness,
  }
}
