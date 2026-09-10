/**
 * A cookie the server can read, saying who is signed in.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 *
 * The real credential is the httpOnly `auth_token` the API sets, and it lives
 * on the API's own domain — birdy-backend.vercel.app, while the app is served
 * from somewhere else. A cookie set for one host is not sent to the other, and
 * httpOnly means nothing here could read it anyway. Everything the app knew
 * about its own session therefore lived in localStorage, which is invisible to
 * middleware and to server rendering.
 *
 * That is why the app used to render nothing at all until it had hydrated:
 * ProtectedLayout returned null until `isClient`, because on the server there
 * was genuinely no way to know whether to show the shell or bounce to /login.
 * The cost was the entire first paint — a prerendered /clients was 53KB of
 * markup containing no visible text.
 *
 * ── What it is and isn't ───────────────────────────────────────────────────
 *
 * This is a hint, not a credential, and it must never be treated as one. It
 * says "someone signed in here, until this time, in this role" so the server
 * can decide what to *render*. Every actual answer still comes from the API,
 * which verifies the real JWT on every request and 401s if it doesn't like it
 * — at which point apiRequest clears this and redirects.
 *
 * Forging it buys you an app shell that immediately 401s. It carries no token
 * and grants no access, so it is deliberately readable by JavaScript: the
 * client is what writes it.
 */

export const SESSION_COOKIE = "birdy_session"

/** Serialise to something short and cookie-safe. */
function encode(session) {
  return encodeURIComponent(JSON.stringify(session))
}

export function parseSession(rawValue) {
  if (!rawValue) return null

  try {
    const session = JSON.parse(decodeURIComponent(rawValue))
    if (!session || typeof session.exp !== "number") return null
    return session
  } catch {
    // Corrupt or from an older shape — treat as no hint rather than as a
    // logged-out signal, so a bad cookie can't lock anyone out.
    return null
  }
}

export function isExpired(session, now = Date.now()) {
  return !session || session.exp <= now
}

/**
 * Write the hint. Called at login, and again on every authenticated page load
 * so that sessions which predate this cookie pick it up without noticing.
 *
 * SameSite=Lax rather than None: nothing cross-site needs to send it, and Lax
 * still travels on the top-level navigations this exists to inform.
 */
export function writeSession({ expiresAt, role = null, onboardingIncomplete = false }) {
  if (typeof document === "undefined") return

  const exp = new Date(expiresAt).getTime()
  if (!Number.isFinite(exp)) return

  const maxAge = Math.max(0, Math.floor((exp - Date.now()) / 1000))
  const value = encode({ exp, role, ob: onboardingIncomplete })
  const secure = window.location.protocol === "https:" ? "; Secure" : ""

  document.cookie = `${SESSION_COOKIE}=${value}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`
}

export function clearSession() {
  if (typeof document === "undefined") return
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; SameSite=Lax`
}

/** Read it back on the client — the same value middleware sees. */
export function readSession() {
  if (typeof document === "undefined") return null

  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${SESSION_COOKIE}=`))

  return parseSession(match?.slice(SESSION_COOKIE.length + 1))
}
