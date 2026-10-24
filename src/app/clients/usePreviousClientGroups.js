"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { PREVIOUS_PERIOD } from "@/lib/portfolio-series";

/**
 * The comparison window's client groups, for the cost-per-lead movement in the
 * Client Hub table. Only some presets have a previous period expressible as
 * another preset (see PREVIOUS_PERIOD); elsewhere, and when the request fails,
 * the hook answers null and the table simply shows no movement.
 *
 * @param {string} preset the table's selected window
 * @returns {{groups: object[]|null, comparison: {preset: string, subtractCurrent?: boolean}|undefined}}
 */
export function usePreviousClientGroups(preset) {
  const comparison = PREVIOUS_PERIOD[preset];
  const [loaded, setLoaded] = useState({ preset: null, groups: null });

  useEffect(() => {
    if (!comparison) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiRequest(queryKeys.clientGroups(comparison.preset, false));
        if (!res.ok) throw new Error(`client-groups ${comparison.preset} → ${res.status}`);
        const data = await res.json();
        if (!cancelled) setLoaded({ preset, groups: data.client_groups ?? [] });
      } catch {
        // No comparison is a fine outcome: the movement just doesn't render.
        if (!cancelled) setLoaded({ preset, groups: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [preset, comparison]);

  // Never hand back another window's groups under this window's label.
  return { groups: comparison && loaded.preset === preset ? loaded.groups : null, comparison };
}
