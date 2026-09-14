"use client"

import { SWRConfig } from "swr"
import { fetcher } from "@/lib/fetcher"

// How long a key counts as fresh. Mount a hook again inside this window — the
// usual case, since leaving a page and coming back remounts every hook on it —
// and SWR serves the cached value without touching the network.
//
// This is the setting that makes navigation feel instant, so it is worth being
// explicit about what it replaces. Every hook in the app used to be a
// useEffect that fetched on mount, so /clients → /dashboard → /clients was two
// full downloads of the same six megabytes. The old defence was a localStorage
// cache with a one-hour TTL, which for the full client-groups payload never
// worked at all: 6.38MB against a ~5MB quota, and setItem's QuotaExceededError
// went into a bare catch.
//
// Five minutes rather than that hour: the cache is now in memory and costs
// nothing to refill, so there is no reason to serve figures that old.
const FRESH_FOR_MS = 5 * 60 * 1000

export default function SWRProvider({ children }) {
  return (
    <SWRConfig
      value={{
        fetcher,

        // Doubles as the freshness window: SWR skips revalidating a key it
        // fetched less than this ago, including on mount.
        dedupingInterval: FRESH_FOR_MS,

        // Alt-tabbing back should not cost a multi-megabyte refetch. Data
        // still refreshes on mount once it's stale, and anything that must be
        // current after a write says so by calling mutate().
        revalidateOnFocus: false,

        // Reconnecting is a real signal that what's on screen may be behind,
        // and it's rare enough to be worth the request.
        revalidateOnReconnect: true,

        // These endpoints are slow rather than flaky, and a failed one is
        // usually failing for a reason that a retry won't fix (a 401 is
        // already handled in apiRequest, which redirects to /login). One
        // retry, not the default five with backoff.
        errorRetryCount: 1,
      }}
    >
      {children}
    </SWRConfig>
  )
}
