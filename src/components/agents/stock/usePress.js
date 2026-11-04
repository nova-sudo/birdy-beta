"use client"

import { useState } from "react"

/**
 * One button press on the report: which one is busy, and what went wrong if it threw.
 * `press` resolves to what the action returned, or undefined when it threw.
 */
export function usePress(fallback = "That didn't work. Try again.") {
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const press = async (key, fn) => {
    setBusy(key)
    setError(null)
    try {
      return await fn()
    } catch (err) {
      setError(err?.message || fallback)
      return undefined
    } finally {
      setBusy(null)
    }
  }
  return { busy, error, press }
}
