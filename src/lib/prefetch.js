import { mutate } from "swr"
import { fetcher } from "./fetcher"
import { queryKeys } from "./query-keys"
import { DEFAULT_DATE_PRESET } from "./constants"

/**
 * Fire-and-forget prefetch of the things the first page needs, started the
 * moment login succeeds.
 *
 * The redirect, the route chunk and the render all take time that would
 * otherwise be spent doing nothing; by the time the landing page mounts its
 * hooks, these are usually already in the cache and it paints without a
 * spinner.
 *
 * It writes straight into the SWR cache rather than localStorage. The old
 * version filled a localStorage entry that, since the hooks moved to SWR,
 * nothing read — and for the full client-groups payload never filled at all,
 * because 6.38MB does not fit a ~5MB quota and the QuotaExceededError went
 * into a bare catch.
 *
 * `revalidate: false` because the value is being written from a fetch that
 * just happened; asking SWR to confirm it would double the request.
 */
export function prefetchAfterLogin() {
  const warm = (key) =>
    fetcher(key)
      .then((data) => mutate(key, data, { revalidate: false }))
      // A failed prefetch is a non-event: the hook that needs the data will
      // ask for it again on mount and report its own error if it matters.
      .catch(() => {})

  return Promise.allSettled([
    warm(queryKeys.clientGroups(DEFAULT_DATE_PRESET)),
    warm(queryKeys.userViews()),
  ])
}
