"use client"

import { useState, useEffect, useCallback } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { UserRoundCog, LogOut } from "lucide-react"
import { toast } from "sonner"
import { Button, SystemBanner } from "@/components/ds"
import { fetchMe, stopImpersonation } from "@/lib/admin-api"
import { rewriteSessionRole } from "@/lib/session"

/**
 * Persistent banner shown across the whole app while an admin is impersonating
 * an agency owner. Reads /api/me (which surfaces the `impersonating`/`act`
 * claims off the session token), keeps localStorage.user in sync with the
 * impersonated identity, and offers a one-click exit that restores the admin.
 *
 * Motion: slides down on enter (spatial — it pushes the app down), quick fade
 * on exit. Respects prefers-reduced-motion.
 */
const EASE = [0.165, 0.84, 0.44, 1]

export default function ImpersonationBar() {
  const reduce = useReducedMotion()
  const [me, setMe] = useState(null)
  const [exiting, setExiting] = useState(false)

  const refresh = useCallback(async () => {
    const data = await fetchMe()
    setMe(data)
    // Keep local identity aligned with the (possibly impersonated) session so
    // admin-only chrome hides while impersonating and returns on exit.
    if (data) {
      try {
        const prev = JSON.parse(localStorage.getItem("user") || "null")
        if (!prev || prev.email !== data.email || prev.role !== data.role) {
          localStorage.setItem("user", JSON.stringify({
            email: data.email, name: data.name, role: data.role,
            default_currency: data.default_currency,
          }))
          window.dispatchEvent(new Event("userUpdated"))
        }
      } catch {
        /* non-fatal */
      }
    }
  }, [])

  useEffect(() => {
    refresh()
    // Re-check when the tab regains focus — catches the 45-min auto-revert
    // back to the admin's own session.
    const onFocus = () => refresh()
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [refresh])

  const handleExit = async () => {
    setExiting(true)
    try {
      await stopImpersonation()
      const admin = await fetchMe()
      if (admin) {
        localStorage.setItem("user", JSON.stringify({
          email: admin.email, name: admin.name, role: admin.role,
          default_currency: admin.default_currency,
        }))
        window.dispatchEvent(new Event("userUpdated"))
        // Back to "admin" before the navigation, or the proxy would turn the
        // admin away from their own console as a non-admin.
        rewriteSessionRole(admin.role)
      }
      window.location.href = "/admin"
    } catch (e) {
      toast.error("Couldn't exit impersonation", { description: e.message })
      setExiting(false)
    }
  }

  const active = !!me?.impersonating

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={reduce ? false : { height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: EASE }}
          className="w-full overflow-hidden shrink-0"
        >
          <SystemBanner
            tone="warning"
            action={
              <Button variant="outline" size="sm" onClick={handleExit} loading={exiting}>
                <LogOut />
                Exit
              </Button>
            }
          >
            <UserRoundCog className="mr-2 inline size-4 align-text-bottom" />
            Impersonating <span className="font-semibold">{me.name || me.email}</span>
            <span className="hidden sm:inline"> ({me.email})</span>
            {me.act && <span className="opacity-80"> · as {me.act}</span>}
          </SystemBanner>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
