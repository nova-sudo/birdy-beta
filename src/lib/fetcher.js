import { apiRequest } from "@/lib/api"

/**
 * The one fetcher every SWR hook in the app uses.
 *
 * SWR keys are the endpoint path, so a key doubles as the request. Two
 * components asking for the same path get one request and one cache entry —
 * which is the whole point: /api/alerts alone was being fetched three times on
 * the dashboard (twice by the notifications bell, once by the page).
 *
 * Errors carry `status` so callers can tell "not authorised" from "not there
 * yet" without re-reading the response.
 */
export async function fetcher(endpoint) {
  const res = await apiRequest(endpoint)

  if (!res.ok) {
    // FastAPI puts the useful part in `detail`. Surfacing it here rather than
    // "Request failed: 402" is what lets a page say "You're out of credits"
    // instead of a status code.
    let detail = `HTTP ${res.status}`
    try {
      const body = await res.json()
      detail = body.detail || body.error || detail
    } catch {
      // Not JSON — the status is all we have.
    }

    const err = new Error(detail)
    err.status = res.status
    throw err
  }

  return res.json()
}

/**
 * For endpoints that may legitimately not exist yet.
 *
 * The dashboard was written to survive its own backend being incomplete —
 * /api/dashboard/summary renders empty tabs rather than an error when the
 * route isn't live. Swallowing that in the fetcher keeps `error` meaning
 * "something went wrong" for everyone else.
 */
export async function optionalFetcher(endpoint) {
  try {
    return await fetcher(endpoint)
  } catch {
    return null
  }
}
