import { apiRequest } from "./api"
import { setCachedData } from "./cache"
import { DEFAULT_DATE_PRESET, CACHE_KEYS } from "./constants"

/**
 * Fire-and-forget prefetch of client-groups and user views after login.
 * Warms the cache so the first page load is instant.
 */
export function prefetchAfterLogin() {
  const groupsPromise = apiRequest(
    `/api/client-groups?date_preset=${DEFAULT_DATE_PRESET}`
  )
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (data?.client_groups) {
        setCachedData(`${CACHE_KEYS.CLIENT_GROUPS}_${DEFAULT_DATE_PRESET}`, {
          groups: data.client_groups,
          meta: data.meta || null,
        })
      }
    })
    .catch(() => {})

  const viewsPromise = apiRequest("/api/user/views")
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (data) {
        setCachedData(CACHE_KEYS.USER_VIEWS, data)
      }
    })
    .catch(() => {})

  return Promise.allSettled([groupsPromise, viewsPromise])
}
