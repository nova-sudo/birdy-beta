import { useCallback, useState } from "react"
import useSWR, { useSWRConfig } from "swr"
import { queryKeys } from "./query-keys"
import { DEFAULT_DATE_PRESET } from "./constants"

const CLIENT_GROUPS_PREFIX = "/api/client-groups"

// How often to re-ask while a group is still being imported. Groups arrive
// from the integrations over a minute or two, and until they land the row
// shows a loading state rather than zeros.
const CREATING_POLL_MS = 10_000

function hasCreatingGroups(groups) {
  return (groups || []).some((g) => g.status === "creating" || g.status === "pending")
}

/**
 * @param {string} initialPreset
 * @param {object} [opts]
 * @param {boolean} [opts.includeDaily] fetch the per-day series too.
 *
 * The daily series — `gohighlevel.daily_leads`, `facebook.daily_spend`,
 * `hotprospector.daily_calls` — are only read by the hubs that draw trend
 * charts. They were served to every caller regardless: 6.38 MB across 67
 * groups (3.79 leads + 2.39 spend + 0.20 calls), most of it going to pages
 * that never touch it. The Clients page alone carried 3.79 MB of lead history
 * it does not plot.
 *
 * ON by default. The saving comes from the pages that do not chart them
 * opting OUT — Clients and alerts — not from every other page having to
 * remember to opt in.
 *
 * It shipped defaulting to off, and that was wrong: any caller unaware of the
 * option silently lost its data. The Lead Hub rendered 0 leads while its own
 * table, served by a different endpoint, showed 1,459. A missing option should
 * cost a caller a bigger payload, never a wrong number.
 *
 * ── On the cache ──────────────────────────────────────────────────────────
 *
 * Six pages call this hook, and each used to fetch on mount, so moving
 * between them re-downloaded and re-parsed the whole payload every time. The
 * defence was localStorage with a one-hour TTL, and for the full variant it
 * never once worked: 6.38 MB does not fit a ~5 MB quota, so every write threw
 * QuotaExceededError into a bare `catch {}` and every read missed.
 *
 * SWR holds it in memory instead, keyed by preset *and* variant, shared across
 * every component asking for the same one. Remounting inside the freshness
 * window (see swr-provider) paints immediately and makes no request; past it,
 * the cached figures stay on screen while it revalidates behind them.
 */
export function useClientGroups(initialPreset = DEFAULT_DATE_PRESET, opts = {}) {
  const { includeDaily = true } = opts
  const [datePreset, setDatePreset] = useState(initialPreset)

  const key = queryKeys.clientGroups(datePreset, includeDaily)
  const { mutate: mutateAny } = useSWRConfig()

  const { data, error, isLoading, mutate } = useSWR(key, {
    // While groups are still importing, keep asking. SWR clears the interval
    // for us when the hook unmounts or the key changes.
    refreshInterval: (latest) => (hasCreatingGroups(latest?.client_groups) ? CREATING_POLL_MS : 0),

    // Deliberately no keepPreviousData. On a preset change the key changes
    // too, and carrying the old data across would put last month's figures
    // under this month's label — the one wrong state worse than a spinner.
    // Within a single key SWR already keeps the last good response through a
    // failed revalidation, so "stale, not wrong" survives without it.
  })

  const clientGroups = data?.client_groups ?? []
  const meta = data?.meta ?? null

  /**
   * Drop every cached preset and variant, then refetch this one.
   *
   * Callers reach for this after changing what the groups *are* — adding one,
   * renaming one, reconnecting an integration. That invalidates every window,
   * not just the one on screen, so this matches on the path rather than the
   * current key.
   */
  const invalidate = useCallback(
    () =>
      mutateAny(
        (k) => typeof k === "string" && k.startsWith(CLIENT_GROUPS_PREFIX),
        undefined,
        { revalidate: true }
      ),
    [mutateAny]
  )

  /** Refetch this preset now, keeping what's on screen until it lands. */
  const refresh = useCallback(() => mutate(), [mutate])

  return {
    clientGroups,
    meta,
    // Loading means "nothing to show yet", not "a request is in flight".
    // SWR's own isLoading is the latter: it stays true through a background
    // revalidation of data we already hold, including data the login prefetch
    // put there, which would spin at the user while the figures sit ready
    // underneath. Revalidating behind cached figures must not blank them.
    loading: isLoading && data === undefined,
    error: error ? error.message : null,
    datePreset,
    setDatePreset,
    invalidate,
    refresh,
  }
}
