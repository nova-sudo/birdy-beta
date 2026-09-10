import { useMemo } from "react"
import useSWR from "swr"
import { useClientGroups } from "./useClientGroups"
import { queryKeys } from "./query-keys"

/**
 * Client groups with their per-day series attached, for the hubs that chart
 * trends.
 *
 * The series used to ride along inside /api/client-groups, and they were the
 * majority of it — 57% of a measured response, against 2% for the Meta metrics
 * the KPI tiles read first. Worse, they are identical for every date preset
 * (each row is a day; the window is applied here, not there), so moving the
 * date picker re-downloaded hundreds of kilobytes of history that had not
 * changed.
 *
 * Now they are their own request, on their own key with no preset in it. Two
 * requests go out together instead of one large one, and changing the preset
 * refetches only the figures — the history is already in the cache.
 *
 * ── Why this reports one loading flag ──────────────────────────────────────
 *
 * Because the alternative has bitten this codebase before. Every aggregator
 * downstream sums `daily_leads` / `daily_spend` / `daily_calls`, and an absent
 * series sums to zero just as convincingly as a real one. Handing a hub the
 * groups the moment they land — series still in flight — would paint a
 * confident 0 on every tile and a flat line on every chart, exactly the
 * failure that made include_daily default to on. So `loading` stays true until
 * both halves are in.
 *
 * The pieces are returned individually as well, so a hub that grows per-widget
 * loading states can paint its Meta tiles early without waiting on history.
 */
export function useClientGroupsWithSeries(initialPreset, opts = {}) {
  // includeDaily: false — this is the whole point. The groups request stops
  // carrying what the second one now fetches.
  const groups = useClientGroups(initialPreset, { ...opts, includeDaily: false })

  const {
    data: seriesData,
    error: seriesError,
    isLoading: seriesLoading,
  } = useSWR(queryKeys.clientGroupsDaily())

  const series = seriesData?.series

  // A failed series request is not a partial page, it is a wrong one.
  //
  // `loading` covers the gap while the series are in flight, but an *error*
  // ends that gap without ever delivering them: loading goes false, the
  // groups look complete, and every aggregator's `?? []` turns the missing
  // history into a confident zero on every tile and a flat line on every
  // chart. The most likely way to hit it is deploying this before the backend
  // that serves /api/client-groups/daily, when the answer is a 404.
  //
  // So the groups are withheld and the error surfaced, which is exactly what
  // useClientGroups already does when its own fetch fails. A hub that charts
  // trends is defined by these series; showing its figures without them is
  // the outcome include_daily exists to prevent.
  const seriesFailed = !!seriesError && series === undefined

  const clientGroups = useMemo(() => {
    if (seriesFailed) return []

    // Nothing to merge onto, or nothing to merge yet: hand back what we have.
    // `loading` below is what stops a caller reading this as finished.
    if (!series) return groups.clientGroups

    return groups.clientGroups.map((group) => {
      const rows = series[group.id]
      if (!rows) return group

      // Written back exactly where they used to live, so the ~1,300 lines of
      // aggregation that read them need no idea this moved.
      return {
        ...group,
        gohighlevel: { ...(group.gohighlevel ?? {}), daily_leads: rows.daily_leads },
        facebook: { ...(group.facebook ?? {}), daily_spend: rows.daily_spend },
        hotprospector: { ...(group.hotprospector ?? {}), daily_calls: rows.daily_calls },
      }
    })
  }, [groups.clientGroups, series, seriesFailed])

  return {
    ...groups,
    clientGroups,
    loading: groups.loading || (seriesLoading && series === undefined),
    error: groups.error ?? (seriesError ? seriesError.message : null),

    // For a caller that wants to paint before the history arrives.
    groupsLoading: groups.loading,
    seriesLoading,
  }
}
