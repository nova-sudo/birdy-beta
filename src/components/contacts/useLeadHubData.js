"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import { presetToDateRange } from "@/lib/date-utils";
import { buildLeadKpis, normaliseLeadStats, previousWindow } from "@/lib/lead-hub-aggregate";

// ─── Where the Lead Hub's headline figures come from ────────────────────────
//
//   /api/leads/unified  meta.stats over the selected window, and again over the
//                       window before it for the delta pills
//
// Both calls ask for a single row. `meta.stats` is an aggregate over the whole
// window rather than over the page, so a page of one carries the same figures
// as a page of fifteen at a fraction of the payload.
//
// They deliberately carry **no pipeline-stage filter**, while the table's own
// query does. The tiles describe the period — every lead and contact in it —
// and the tabs beneath choose which of those rows you are looking at. Running
// the tiles through the tab filter as well would make "Total leads" mean
// "total won leads" the moment you opened the Won tab, which is a different
// figure wearing the same label.

/**
 * @param {string} datePreset the window every figure covers
 * @param {string} selectedClientGroup group id, or "all"
 * @param {boolean} ready false while the group list is still loading
 */
export function useLeadHubData({ datePreset, selectedClientGroup, ready = true }) {
  const [current, setCurrent] = useState(null);
  const [previous, setPrevious] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // "" is how this endpoint spells every group the caller can see.
  const groupsParam = selectedClientGroup && selectedClientGroup !== "all" ? selectedClientGroup : "";

  useEffect(() => {
    if (!ready) return;

    let cancelled = false;
    const controller = new AbortController();

    const statsFor = async (window) => {
      if (!window) return null;
      const params = new URLSearchParams({ groups: groupsParam, page: "1", limit: "1" });
      if (window.start_date) params.set("start_date", window.start_date);
      if (window.end_date) params.set("end_date", window.end_date);

      const res = await apiRequest(`/api/leads/unified?${params}`, { signal: controller.signal });
      if (!res.ok) throw new Error(`leads/unified → ${res.status}`);
      const data = await res.json();
      return normaliseLeadStats(data?.meta?.stats);
    };

    (async () => {
      setStatsLoading(true);
      try {
        const now = await statsFor(presetToDateRange(datePreset));
        if (!cancelled) setCurrent(now);
      } catch (err) {
        if (err.name !== "AbortError" && !cancelled) setCurrent(null);
      } finally {
        if (!cancelled) setStatsLoading(false);
      }

      try {
        // A failed or absent comparison is a fine outcome — the pills just
        // don't render, which is what an unknown delta should look like.
        const before = await statsFor(previousWindow(datePreset));
        if (!cancelled) setPrevious(before);
      } catch {
        if (!cancelled) setPrevious(null);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [ready, groupsParam, datePreset]);

  const kpis = useMemo(() => buildLeadKpis(current, previous), [current, previous]);

  return { current, previous, kpis, statsLoading, hasComparison: previous != null };
}
