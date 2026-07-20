"use client"

import { useState, useEffect } from "react"

/**
 * Current user's role, read from the persisted `user` object that LoginForm
 * writes to localStorage (the backend now includes `role` in the login and
 * /api/me responses). Defaults to "user" so admin-only UI never flashes for a
 * normal account on first paint or during SSR.
 *
 * Stays in sync across tabs via the native `storage` event and within the
 * same tab via a custom "userUpdated" event (fired by the impersonation flow
 * when it rewrites localStorage.user to the impersonated identity).
 */
function readRole() {
  try {
    const raw = localStorage.getItem("user")
    const user = raw ? JSON.parse(raw) : null
    return user?.role || "user"
  } catch {
    return "user"
  }
}

export function useRole() {
  const [role, setRole] = useState("user")

  useEffect(() => {
    setRole(readRole())
    const onStorage = (e) => {
      if (e.key === "user") setRole(readRole())
    }
    const onUserUpdated = () => setRole(readRole())
    window.addEventListener("storage", onStorage)
    window.addEventListener("userUpdated", onUserUpdated)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("userUpdated", onUserUpdated)
    }
  }, [])

  return { role, isAdmin: role === "admin" }
}
