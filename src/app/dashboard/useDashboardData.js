"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { apiRequest } from "@/lib/api";
import { optionalFetcher } from "@/lib/fetcher";
import { queryKeys } from "@/lib/query-keys";
import { METRIC_OPTIONS, conditionSummary } from "@/lib/alert-helpers";

// ─── Backend contract ──────────────────────────────────────────────────────
// The endpoints the homepage calls. Every call fails gracefully to an empty
// tab, so the page works whether or not the route is live yet — it never
// shows placeholder data.
//
//   GET    /api/dashboard/summary
//     → { suggestions: [...], wins: [...], activity: [...] }
//   POST   /api/dashboard/suggestions/:id/apply
//   POST   /api/dashboard/suggestions/:id/undo
//   DELETE /api/dashboard/suggestions/:id
//   POST   /api/dashboard/wins/:id/complete
//
// Alerts come from /api/alerts instead (the same store the Alerts page and
// the notifications bell read), so the homepage lists the individual
// triggered clients rather than the parent roll-up.

function metricLabel(row) {
  const metric = row.condition?.metric;
  return METRIC_OPTIONS.find((o) => o.value === metric)?.label || metric || "";
}

// /api/alerts returns triggered rows flat: a per-client alert yields one
// `_virtual` row per breaching client, an account-wide alert yields one row.
// The homepage shows those per-client rows directly — a card per client that
// actually breached — instead of one "Zero Ad Spend · 66 clients" parent card.
export function expandTriggeredAlerts(rows) {
  return (rows || []).map((row) => {
    const isSub = !!row._virtual;
    const actual = isSub ? row._client_value : row.current_value;
    const targets = row.target_group_names?.length ? row.target_group_names : null;

    return {
      id: isSub ? String(row._virtual_id ?? `${row.id}_${row._client_id}`) : `real_${row.id}`,
      alertId: row.id,
      clientId: isSub ? row._client_id : null,
      color: row.type === "win" ? "amber" : "red",
      // Sub-alerts lead with the client — the alert name is the reason line.
      title: isSub ? row._client_name : row.name,
      client: isSub ? row.name : targets?.slice(0, 2).join(", ") || "All clients",
      badge: [metricLabel(row), conditionSummary(row)].filter(Boolean).join(" "),
      badgeTone: "gray",
      actual: actual == null ? null : Number(actual),
      triggeredAt: row.last_triggered_at,
      cta: isSub && row._client_id ? "Open client" : "View alert",
      ctaVariant: "outline",
    };
  });
}

export function useDashboardData() {
  // Both endpoints go through optionalFetcher: this page was written to
  // survive its own backend being incomplete, showing empty tabs rather than
  // an error when a route isn't live yet. It never falls back to placeholder
  // data — an empty tab is honest, invented figures are not.
  //
  // They stay two requests rather than one because a slow or failing summary
  // must not hide the alerts, or the other way round. The alerts key is the
  // same one the notifications bell uses, so on this page the two share a
  // single response instead of asking twice.
  const { data: summary, isLoading: loading } = useSWR(
    queryKeys.dashboardSummary(),
    optionalFetcher
  );
  const { data: alertData, isLoading: alertsLoading } = useSWR(
    queryKeys.alerts(),
    optionalFetcher
  );

  // Local overlays. Applying, undoing or dismissing a suggestion updates the
  // screen straight away rather than waiting for a refetch, so what the user
  // did to a row lives here on top of what the server last said.
  const [suggestionOverride, setSuggestions] = useState(null);
  const [winsOverride, setWins] = useState(null);
  const [alertsOverride, setAlerts] = useState(null);
  const [activityOverride, setActivity] = useState(null);

  const suggestions = suggestionOverride ?? summary?.suggestions ?? [];
  const wins = winsOverride ?? summary?.wins ?? [];
  const activity = activityOverride ?? summary?.activity ?? [];

  const fetchedAlerts = useMemo(
    () => expandTriggeredAlerts(alertData?.triggered),
    [alertData]
  );
  const alerts = alertsOverride ?? fetchedAlerts;

  return {
    suggestions, setSuggestions,
    alerts, setAlerts,
    wins, setWins,
    activity, setActivity,
    // Tab counts are whatever each tab actually holds.
    counts: {
      suggestions: suggestions.length,
      alerts: alerts.length,
      wins: wins.length,
    },
    loading,
    alertsLoading,
  };
}

// ─── Actions ────────────────────────────────────────────────────────────────
// Each fires the real request first; if the endpoint isn't live yet the
// caller still gets a resolved promise so the optimistic UI update proceeds.

/** Returns the response body on success (incl. `succeeded`), or null on failure. */
export async function applySuggestion(id) {
  try {
    const res = await apiRequest(`/api/dashboard/suggestions/${id}/apply`, { method: "POST" });
    if (!res.ok) return null;
    return await res.json().catch(() => ({ ok: true }));
  } catch {
    return null;
  }
}

/** Reverse an applied suggestion — re-enables exactly the ads it paused. */
export async function undoSuggestion(id) {
  try {
    const res = await apiRequest(`/api/dashboard/suggestions/${id}/undo`, { method: "POST" });
    if (!res.ok) return null;
    return await res.json().catch(() => ({ ok: true }));
  } catch {
    return null;
  }
}

export async function dismissSuggestion(id) {
  try {
    const res = await apiRequest(`/api/dashboard/suggestions/${id}`, { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function completeWin(id) {
  try {
    const res = await apiRequest(`/api/dashboard/wins/${id}/complete`, { method: "POST" });
    return res.ok;
  } catch {
    return false;
  }
}
