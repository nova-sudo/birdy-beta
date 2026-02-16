/**
 * lib/checkExpiredTokens.js
 *
 * Shared helper used by:
 *  - LoginForm  (post-login)
 *  - settings/page.jsx  (post-OAuth-callback)
 *
 * Flow:
 *  1. Call /api/status
 *  2. If GHL agency token is absent or expired → redirect to /api/connect
 *  3. Else if Meta token was previously connected but is now expired → redirect to /api/connect/facebook
 *  4. Otherwise return the intended destination so the caller can router.push() it
 *
 * Returns:
 *  - null   → a full-page redirect has already been initiated; caller should do nothing
 *  - string → the path the caller should navigate to
 */

const API_BASE =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL
    : "https://birdy-backend.vercel.app"

/**
 * @param {string} intendedRedirect  Where to send the user once all tokens are fresh
 * @returns {Promise<string|null>}
 */
export async function checkAndRefreshExpiredTokens(intendedRedirect = "/clients") {
  try {
    // ── Fetch current token status ─────────────────────────────────────────
    const statusRes = await fetch(`${API_BASE}/api/status`, {
      credentials: "include",
    })

    if (!statusRes.ok) {
      console.warn("checkAndRefreshExpiredTokens: /api/status returned", statusRes.status)
      return intendedRedirect
    }

    const status = await statusRes.json()

    // ── GoHighLevel ────────────────────────────────────────────────────────
    const ghlAgency = status?.gohighlevel?.agency ?? {}
    const ghlConnected = ghlAgency.connected === true
    const ghlExpired =
      !ghlConnected ||
      ghlAgency.token_expired === true ||
      (ghlAgency.expires_at && new Date(ghlAgency.expires_at) < new Date())

    if (ghlExpired) {
      const connectRes = await fetch(`${API_BASE}/api/connect`, {
        credentials: "include",
      })

      if (connectRes.ok) {
        const { auth_url } = await connectRes.json()
        if (auth_url) {
          // Persist the destination so settings page can continue after OAuth
          sessionStorage.setItem("post_integration_redirect", intendedRedirect)
          window.location.href = auth_url
          return null
        }
      }

      // If we couldn't get an auth URL, fall through rather than blocking the user
      console.warn("checkAndRefreshExpiredTokens: could not obtain GHL auth URL")
    }

    // ── Meta / Facebook ────────────────────────────────────────────────────
    const fbStatus = status?.facebook ?? {}
    const fbConnected = fbStatus.connected === true
    const fbExpired =
      fbConnected && // only re-auth if it was previously connected
      (fbStatus.token_expired === true ||
        (fbStatus.expires_at && new Date(fbStatus.expires_at) < new Date()))

    if (fbExpired) {
      const connectRes = await fetch(`${API_BASE}/api/connect/facebook`, {
        credentials: "include",
      })

      if (connectRes.ok) {
        const { auth_url } = await connectRes.json()
        if (auth_url) {
          sessionStorage.setItem("post_integration_redirect", intendedRedirect)
          window.location.href = auth_url
          return null
        }
      }

      console.warn("checkAndRefreshExpiredTokens: could not obtain Meta auth URL")
    }

    // All good — return the intended destination
    return intendedRedirect
  } catch (err) {
    console.warn("checkAndRefreshExpiredTokens: unexpected error", err)
    return intendedRedirect
  }
}
