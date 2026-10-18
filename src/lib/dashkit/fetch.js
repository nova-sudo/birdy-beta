import { apiRequest, API_BASE_URL } from "@/lib/api"

/** Base URL dashkit's fetch adapters append `/dashboards...` to. */
export const DASHKIT_BASE_URL = `${API_BASE_URL}/api`

/**
 * dashkit builds absolute URLs and hands them to a fetch-shaped function.
 * apiRequest wants a path (it prepends API_BASE_URL itself) and is the only
 * thing that sends the session cookie and handles the 401 redirect, so strip
 * the origin back off and route every dashkit call through it.
 */
export function dashkitFetch(url, init) {
  return apiRequest(url.replace(API_BASE_URL, ""), init)
}
