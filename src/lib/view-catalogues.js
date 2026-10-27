// lib/view-catalogues.js
// What Birdy needs to save table views from chat, and how it hands them back.
//
// A saved view is a named column set (see usePageViews), and each hub builds
// its column list in the browser — GHL fields and tags included. So every hub
// table saves its list as it renders: to the account (so any page or device
// can use it) and to this browser, whose copies each chat request also sends
// as the freshest (`view_catalogues`). That lets Birdy make a Leads view while
// you chat from Marketing. When Birdy saves one, the reply's `page_view_ops` are
// announced as window events; the page showing that table picks the view up
// and applies it.

import { useEffect } from "react"
import { apiRequest } from "@/lib/api"

const STORAGE_KEY = "birdy_view_catalogues"
// page -> signature of the list last saved to the account, so a visit only
// writes when the columns changed.
const SYNCED_KEY = "birdy_view_catalogues_synced"
// Generous for tag-heavy accounts, but bounded so one request stays small.
const MAX_COLUMNS = 400

export const VIEW_CREATED_EVENT = "birdy:view-created"
export const VIEW_REMOVED_EVENT = "birdy:view-removed"

export function readViewCatalogues() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function writeViewCatalogue(page, entry) {
  try {
    const all = readViewCatalogues()
    all[page] = entry
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    // Storage blocked or full: Birdy just won't know this page's columns.
  }
}

function readSynced() {
  try {
    return JSON.parse(window.localStorage.getItem(SYNCED_KEY) || "{}") || {}
  } catch {
    return {}
  }
}

async function syncViewCatalogue(page, entry, signature) {
  const synced = readSynced()
  if (synced[page] === signature) return
  try {
    const res = await apiRequest(`/api/user/view-catalogues/${encodeURIComponent(page)}`, {
      method: "PUT",
      body: JSON.stringify(entry),
    })
    if (!res.ok) return
    window.localStorage.setItem(SYNCED_KEY, JSON.stringify({ ...readSynced(), [page]: signature }))
  } catch {
    // Offline or storage blocked: the next visit tries again.
  }
}

/**
 * Remember a hub table's columns for Birdy.
 *
 * @param {string} page Saved-view page key (`clients`, `contacts`, `mktg_<tab>`, `cc_<tab>`)
 * @param {{ label: string, path: string, columns: {id: string, label?: string, source?: string}[] }} entry
 */
export function useRememberViewCatalogue(page, { label, path, columns }) {
  // Some pages rebuild their column list every render; key the write on its
  // content so it only happens when the list really changes.
  const trimmed = (columns ?? []).slice(0, MAX_COLUMNS).map(({ id, label: l, source }) => ({
    id,
    label: typeof l === "string" ? l : id,
    ...(source ? { source } : {}),
  }))
  const signature = JSON.stringify(trimmed)

  useEffect(() => {
    const cols = JSON.parse(signature)
    if (!page || !cols.length) return
    const entry = { label, path, columns: cols }
    writeViewCatalogue(page, entry)
    syncViewCatalogue(page, entry, JSON.stringify(entry))
  }, [page, label, path, signature])
}

/** Tell any mounted table that Birdy saved a view on it. */
export function announceViewOps(ops) {
  if (typeof window === "undefined") return
  for (const op of ops ?? []) {
    if (op?.type === "view_created") {
      window.dispatchEvent(new CustomEvent(VIEW_CREATED_EVENT, { detail: op }))
    }
  }
}

/** Undo for a Birdy-made view: delete it and drop it from the open picker. */
export async function removeBirdyView(op) {
  const res = await apiRequest(
    `/api/user/page-views/${op.view.id}?page=${encodeURIComponent(op.page)}`,
    { method: "DELETE" },
  )
  if (!res.ok) return false
  window.dispatchEvent(new CustomEvent(VIEW_REMOVED_EVENT, { detail: op }))
  return true
}
