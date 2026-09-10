import { setBusy, flash } from "@/components/birdy/birdy-store"
import { clearSession } from "@/lib/session"

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://birdy-backend.vercel.app"

// Flashing success/error on every GET (dashboard polling, chart loads, etc.)
// would make the mascot twitch constantly, so the automatic flash below is
// scoped to mutations — the requests that actually have an outcome worth a
// second or two of reaction between "loading" and settling back to "follow".
function isMutation(options) {
  const method = (options.method || "GET").toUpperCase()
  return method !== "GET"
}

/**
 * Headers for a cross-origin request, kept as close to none as possible.
 *
 * The dashboard and the API are on different origins, so every request the
 * browser can't classify as "simple" costs an extra OPTIONS round-trip before
 * the real one — measured at ~350ms against the deployed backend. A GET is
 * simple only when it carries no headers beyond the CORS-safelisted ones, and
 * the safelist does not include Content-Type: application/json.
 *
 * So a content type is set only when there is a body to describe. Sending it
 * on GETs bought nothing and preflighted every one of them; worse, the
 * preflight cache is keyed per URL, so each date preset and each query string
 * paid it again.
 *
 * There is deliberately no Authorization header. The API reads the JWT from
 * the auth_token cookie and nowhere else — dependencies.py::get_current_user
 * is the only auth path and it calls request.cookies.get("auth_token") — so
 * the Bearer token this used to attach from localStorage was never what
 * authenticated anything. It only made every GET non-simple. The cookie is
 * httpOnly and travels on credentials: "include" below.
 */
function buildHeaders(options) {
  const headers = { ...options.headers }
  const hasBody = options.body !== undefined && options.body !== null
  const hasContentType = Object.keys(headers).some(
    (key) => key.toLowerCase() === "content-type"
  )

  if (hasBody && !hasContentType) {
    headers["Content-Type"] = "application/json"
  }

  return headers
}

/**
 * Make an authenticated API request.
 * Auth rides on the httpOnly auth_token cookie via credentials: "include"
 * (see buildHeaders for why there is no Authorization header); a 401 clears
 * the local session and sends the user to /login.
 * The Birdy mascot floats (its "loading" state) for as long as any request
 * made through here or publicRequest() is in flight, and for mutations
 * (POST/PUT/PATCH/DELETE) flashes success/error once it settles — see
 * birdy-store.js.
 */
export async function apiRequest(endpoint, options = {}) {
  const headers = buildHeaders(options)

  const mutation = isMutation(options)
  setBusy(true)
  let response
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: "include",
    })
  } catch (err) {
    setBusy(false)
    if (mutation) flash("error")
    throw err
  }
  setBusy(false)

  if (response.status === 401) {
    localStorage.removeItem("auth_token")
    localStorage.removeItem("refresh_token")
    localStorage.removeItem("user")
    localStorage.removeItem("user_authenticated")
    clearSession()
    window.location.href = "/login"
    throw new Error("Unauthorized")
  }

  if (mutation) flash(response.ok ? "success" : "error")

  return response
}

/**
 * Make an unauthenticated API request (for login, register, public endpoints).
 */
export async function publicRequest(endpoint, options = {}) {
  const headers = buildHeaders(options)

  const mutation = isMutation(options)
  setBusy(true)
  let response
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: "include",
    })
  } catch (err) {
    setBusy(false)
    if (mutation) flash("error")
    throw err
  }
  setBusy(false)

  if (mutation) flash(response.ok ? "success" : "error")

  return response
}
