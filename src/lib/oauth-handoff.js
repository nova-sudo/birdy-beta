/**
 * lib/oauth-handoff.js
 *
 * Every integration's OAuth callback lands on /settings — that is the redirect
 * URI registered with GHL, Meta and Slack, and it is the same one whether the
 * hop started from the settings page or from somewhere else. When it started
 * somewhere else (today: the onboarding wizard) that page parks its return path
 * here before leaving, and /settings sends the user back on arrival.
 *
 * The problem this module exists to solve is what the user sees in between.
 * /settings is a static route whose prerendered document already contains the
 * sidebar and the top bar, so the browser paints an app shell the moment the
 * response lands, then hydrates the integrations page into it, and only then
 * runs the effect that redirects. Coming out of the wizard that read as a
 * half-second flash of a settings screen the user never asked for.
 *
 * Nothing running on the page can prevent that: by the time any of it executes,
 * the shell is on screen. So the return path is written twice, for two readers
 * at two different moments:
 *
 *   · a cookie, read by proxy.js before the response is generated. This is the
 *     one that removes the flash — the callback is redirected server-side and
 *     /settings is never served at all.
 *   · sessionStorage, read by the settings page. This is the fallback for when
 *     the page does get rendered — cookies blocked, a stale deploy — and it
 *     still keeps the integrations panel itself from painting.
 *
 * Neither outlives the hop: sessionStorage dies with the tab, and the cookie
 * has minutes on it and is cleared by the redirect that consumes it. An
 * abandoned hop must not strand the next visit to /settings on a redirect
 * nobody asked for.
 */

export const HANDOFF_KEY = "post_integration_redirect"

// Same value, in the one storage a request interceptor can read. Not a session
// or auth concern: it holds a path this browser chose for itself moments ago,
// and proxy.js only ever redirects to a path on this origin.
export const HANDOFF_COOKIE = "birdy_oauth_return"

// Long enough for a slow OAuth consent screen, short enough that an abandoned
// hop is forgotten rather than replayed on some unrelated later visit.
const HANDOFF_COOKIE_MAX_AGE = 15 * 60

// Every accessor is guarded. sessionStorage throws outright in a few real
// browser configurations (Safari's private mode historically, anything with
// site data blocked), and none of this is worth taking the page down for: the
// fallback is the old behaviour, which is a redirect that happens a beat later.
export function setOAuthHandoff(path) {
  try {
    sessionStorage.setItem(HANDOFF_KEY, path)
  } catch { /* no handoff — /settings keeps the user, which is survivable */ }
  try {
    // SameSite=Lax deliberately: the callback arrives as a top-level GET
    // navigation from the provider's domain, which Lax allows and Strict
    // would drop — dropping it here would silently cost the flash-free path
    // on every hop. Not HttpOnly, because setOAuthHandoff is the writer.
    document.cookie =
      `${HANDOFF_COOKIE}=${encodeURIComponent(path)}; Path=/; Max-Age=${HANDOFF_COOKIE_MAX_AGE}; SameSite=Lax`
  } catch { /* falls back to the sessionStorage reader on the page itself */ }
}

export function peekOAuthHandoff() {
  try {
    return sessionStorage.getItem(HANDOFF_KEY)
  } catch {
    return null
  }
}

/** Read and clear in one go, so a redirect can only ever be honoured once. */
export function takeOAuthHandoff() {
  const path = peekOAuthHandoff()
  try {
    sessionStorage.removeItem(HANDOFF_KEY)
  } catch { /* already gone, or unreadable — either way there is nothing to clear */ }
  try {
    document.cookie = `${HANDOFF_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
  } catch { /* it expires on its own within the quarter-hour */ }
  return path
}

/**
 * Is `path` somewhere we are willing to send a browser? A same-origin absolute
 * path and nothing else — no scheme, and no leading "//", which a URL parser
 * reads as a protocol-relative link to another host. The value only ever comes
 * from this app's own code, but it arrives back as a cookie, and a cookie is
 * something the person holding the browser can edit.
 */
export function isSafeHandoffPath(path) {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//")
}

/**
 * Is this load an integration callback? True for all three shapes the backend
 * sends back: GHL/Meta return `tokens` with `status=success`, Slack returns
 * `status=success` alone, and any of them can return `status=error` instead.
 */
export function isIntegrationCallback(search) {
  const query =
    search ?? (typeof window === "undefined" ? "" : window.location.search)
  const params = new URLSearchParams(query)
  return params.has("tokens") || params.has("status") || params.has("error")
}

/**
 * Is /settings only a waypoint on this load — a callback that already knows it
 * is going somewhere else the moment it has read the URL?
 *
 * Server-side this is always false, and it has to be: there is no sessionStorage
 * there, and answering "no" means the worst case is the behaviour we had before.
 */
export function isPassingThrough(search) {
  if (typeof window === "undefined") return false
  return isIntegrationCallback(search) && Boolean(peekOAuthHandoff())
}
