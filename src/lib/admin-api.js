"use client"

import useSWR from "swr"
import { apiRequest } from "@/lib/api"

/**
 * Data layer for the internal Admin console. Thin SWR hooks over the
 * `/api/admin/*` endpoints (all gated by require_admin on the backend), plus
 * the impersonation + identity mutations. Mirrors the app's existing
 * apiRequest pattern (cookie auth, 401 -> logout).
 */

async function fetcher(endpoint) {
  const res = await apiRequest(endpoint)
  if (!res.ok) {
    const err = new Error(`Request failed: ${res.status}`)
    err.status = res.status
    throw err
  }
  return res.json()
}

export function useAgencies(search = "") {
  const qs = search ? `?search=${encodeURIComponent(search)}` : ""
  return useSWR(`/api/admin/agencies${qs}`, fetcher, { keepPreviousData: true })
}

export function usePlatformStats() {
  return useSWR("/api/admin/stats", fetcher)
}

export function useAiQueries(days = 7) {
  return useSWR(`/api/admin/ai-queries?days=${days}`, fetcher)
}

export function useUserConversations(email) {
  return useSWR(
    email ? `/api/admin/users/${encodeURIComponent(email)}/conversations` : null,
    fetcher,
  )
}

export function useConversation(sessionId) {
  return useSWR(
    sessionId ? `/api/admin/conversations/${encodeURIComponent(sessionId)}` : null,
    fetcher,
  )
}

export function useCreditsConfig() {
  return useSWR("/api/admin/credits/config", fetcher)
}

export function useCreditsAccounts(search = "") {
  const qs = search ? `?search=${encodeURIComponent(search)}` : ""
  return useSWR(`/api/admin/credits${qs}`, fetcher, { keepPreviousData: true })
}

// ── Mutations ──────────────────────────────────────────────────────────────

export async function startImpersonation(targetEmail) {
  const res = await apiRequest("/api/admin/impersonate", {
    method: "POST",
    body: JSON.stringify({ target_email: targetEmail }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || "Failed to start impersonation")
  }
  return res.json()
}

export async function stopImpersonation() {
  const res = await apiRequest("/api/admin/impersonate/stop", { method: "POST" })
  if (!res.ok) throw new Error("Failed to stop impersonation")
  return res.json()
}

export async function updateCreditsConfig({ markup, rate_mode, enforce }) {
  const res = await apiRequest("/api/admin/credits/config", {
    method: "PUT",
    body: JSON.stringify({ markup, rate_mode, enforce }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || "Failed to update credits settings")
  }
  return res.json()
}

export async function fetchMe() {
  try {
    const res = await apiRequest("/api/me")
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}
