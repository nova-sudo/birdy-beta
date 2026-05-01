export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8004"

/**
 * Make an authenticated API request.
 * Automatically includes auth token, credentials, and handles 401 → logout.
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

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: "include",
  })

  if (response.status === 401) {
    localStorage.removeItem("auth_token")
    localStorage.removeItem("refresh_token")
    localStorage.removeItem("user")
    localStorage.removeItem("user_authenticated")
    document.cookie = "client_auth_token=; path=/; max-age=0"
    window.location.href = "/login"
    throw new Error("Unauthorized")
  }

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

  return fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: "include",
  })
}
