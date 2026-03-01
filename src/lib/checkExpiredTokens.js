/**
 * lib/checkExpiredTokens.js
 *
 * Queue-based OAuth refresh — handles ANY combination of expired tokens.
 *
 * How it works:
 *  1. On first call (login), inspect /api/status and build a queue of every
 *     integration that needs re-auth: e.g. ["gohighlevel", "facebook"]
 *  2. Persist { queue, intendedRedirect } in sessionStorage, then redirect to
 *     the first integration's OAuth URL. Return null so the caller does nothing.
 *  3. After each OAuth round-trip the browser lands back on /settings with
 *     ?status=success. The settings page calls checkAndRefreshExpiredTokens
 *     again (with the stored intendedRedirect).
 *  4. We pop the first item off the persisted queue. If items remain, redirect
 *     to the next one. If the queue is empty, return intendedRedirect so the
 *     caller can router.push() the user to their destination.
 *
 * Returns:
 *  null   → a full-page OAuth redirect has been initiated; caller does nothing
 *  string → path the caller should navigate to (all tokens are now fresh)
 */

const API_BASE =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL
    : "https://birdy-backend.vercel.app"

const STORAGE_KEY = "oauth_refresh_queue"

// ── Helpers ──────────────────────────────────────────────────────────────────

function loadQueue() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null")
  } catch {
    return null
  }
}

function saveQueue(queue, intendedRedirect) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ queue, intendedRedirect }))
}

function clearQueue() {
  sessionStorage.removeItem(STORAGE_KEY)
}

const CONNECT_ENDPOINTS = {
  gohighlevel: "/api/connect",
  facebook: "/api/connect/facebook",
}

async function redirectToOAuth(integration, queue, intendedRedirect) {
  const endpoint = CONNECT_ENDPOINTS[integration]
  if (!endpoint) return false

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, { credentials: "include" })
    if (!res.ok) return false

    const { auth_url } = await res.json()
    if (!auth_url) return false

    // Persist remaining queue (already popped the current integration)
    saveQueue(queue, intendedRedirect)
    window.location.href = auth_url
    return true
  } catch {
    return false
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * @param {string} intendedRedirect  Where to send the user once all tokens are fresh
 * @returns {Promise<string|null>}
 */
export async function checkAndRefreshExpiredTokens(intendedRedirect = "/clients") {
  try {
    // ── CASE A: Resuming from a stored queue (mid-chain OAuth callback) ──────
    const stored = loadQueue()
    if (stored && Array.isArray(stored.queue) && stored.queue.length > 0) {
      const destination = stored.intendedRedirect || intendedRedirect
      const [next, ...remaining] = stored.queue

      if (remaining.length > 0) {
        // More integrations still need refreshing — redirect to the next one
        const redirected = await redirectToOAuth(next, remaining, destination)
        if (redirected) return null
        // If redirect failed, fall through and try the rest below
      } else {
        // This was the last item — we're done, clear and navigate
        clearQueue()
        return destination
      }
    }

    // ── CASE B: Fresh check — inspect status and build a new queue ───────────
    clearQueue() // clear any stale queue first

    const statusRes = await fetch(`${API_BASE}/api/status`, { credentials: "include" })
    if (!statusRes.ok) {
      console.warn("checkAndRefreshExpiredTokens: /api/status returned", statusRes.status)
      return intendedRedirect
    }

    const status = await statusRes.json()

    const needsRefresh = []

    // GoHighLevel — refresh if absent, not connected, or token expired
    const ghlAgency = status?.gohighlevel?.agency ?? {}
    const ghlNeedsRefresh =
      !ghlAgency.connected ||
      ghlAgency.token_expired === true ||
      (ghlAgency.expires_at && new Date(ghlAgency.expires_at) < new Date())

    if (ghlNeedsRefresh) {
      needsRefresh.push("gohighlevel")
    }

    // Meta — only re-auth if it was previously connected and is now expired
    const fbStatus = status?.facebook ?? {}
    const fbNeedsRefresh =
      fbStatus.connected === true &&
      (fbStatus.token_expired === true ||
        (fbStatus.expires_at && new Date(fbStatus.expires_at) < new Date()))

    if (fbNeedsRefresh) {
      needsRefresh.push("facebook")
    }

    // Nothing to refresh — send the user straight to their destination
    if (needsRefresh.length === 0) {
      return intendedRedirect
    }

    // Kick off the first redirect, storing the rest of the queue
    const [first, ...rest] = needsRefresh
    const redirected = await redirectToOAuth(first, rest, intendedRedirect)
    if (redirected) return null

    // If the redirect failed for the first item, try subsequent ones
    for (const integration of rest) {
      const fallbackRedirected = await redirectToOAuth(
        integration,
        rest.slice(rest.indexOf(integration) + 1),
        intendedRedirect
      )
      if (fallbackRedirected) return null
    }

    // All redirects failed — just send the user to their destination anyway
    console.warn("checkAndRefreshExpiredTokens: all OAuth redirects failed, proceeding anyway")
    return intendedRedirect
  } catch (err) {
    console.warn("checkAndRefreshExpiredTokens: unexpected error", err)
    return intendedRedirect
  }
}