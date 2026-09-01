import { setBusy, flash } from "@/components/birdy/birdy-store"

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
 * Make an authenticated API request.
 * Automatically includes auth token, credentials, and handles 401 → logout.
 * The Birdy mascot floats (its "loading" state) for as long as any request
 * made through here or publicRequest() is in flight, and for mutations
 * (POST/PUT/PATCH/DELETE) flashes success/error once it settles — see
 * birdy-store.js.
 */
export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem("auth_token")

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

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
    document.cookie = "client_auth_token=; path=/; max-age=0"
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
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  }

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
