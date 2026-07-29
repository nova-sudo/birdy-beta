"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { METRIC_OPTIONS, conditionSummary } from "@/lib/alert-helpers";
import {
  MOCK_SUGGESTIONS,
  MOCK_WINS,
  MOCK_ACTIVITY,
  MOCK_TAB_COUNTS,
} from "./mockData";

// ─── Backend contract ──────────────────────────────────────────────────────
// These are the endpoints the homepage is wired to call. None exist yet —
// every call fails gracefully and falls back to the bundled mock data, so
// the UI works today and needs zero changes once the routes are live.
//
//   GET    /api/dashboard/summary
//     → { suggestions: [...], wins: [...], activity: [...],
//         counts: { suggestions, alerts, wins } }
//   POST   /api/dashboard/suggestions/:id/apply
//   POST   /api/dashboard/suggestions/:id/undo
//   DELETE /api/dashboard/suggestions/:id
//   POST   /api/dashboard/wins/:id/complete
//
// Alerts are the exception: they are live today. They come from /api/alerts
// (the same store the Alerts page and the notifications bell read) so the
// homepage lists the individual triggered clients rather than the parent
// roll-up — never mock data, and never the summary's `alerts` field.

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
  const [suggestions, setSuggestions] = useState(MOCK_SUGGESTIONS);
  const [alerts, setAlerts] = useState([]);
  const [wins, setWins] = useState(MOCK_WINS);
  const [activity, setActivity] = useState(MOCK_ACTIVITY);
  const [counts, setCounts] = useState(MOCK_TAB_COUNTS);
  const [loading, setLoading] = useState(true);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [usingMockData, setUsingMockData] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await apiRequest("/api/dashboard/summary");
        if (!res.ok) throw new Error(`GET /api/dashboard/summary → ${res.status}`);
        const data = await res.json();
        if (cancelled) return;

        setSuggestions(data.suggestions ?? MOCK_SUGGESTIONS);
        setWins(data.wins ?? MOCK_WINS);
        setActivity(data.activity ?? MOCK_ACTIVITY);
        setCounts(data.counts ?? MOCK_TAB_COUNTS);
        setUsingMockData(false);
      } catch {
        // Backend not ready yet — keep the mock data already in state.
        if (!cancelled) setUsingMockData(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // Alerts tab — the real triggered sub-alerts, one per breaching client. Runs
  // independently of the summary call so a slow/failing summary doesn't hide
  // them, and vice versa. On failure the tab stays empty; it never falls back
  // to placeholder alerts.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await apiRequest("/api/alerts");
        if (!res.ok) throw new Error(`GET /api/alerts → ${res.status}`);
        const data = await res.json();
        if (cancelled) return;

        setAlerts(expandTriggeredAlerts(data.triggered));
      } catch {
        if (!cancelled) setAlerts([]);
      } finally {
        if (!cancelled) setAlertsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return {
    suggestions, setSuggestions,
    alerts, setAlerts,
    wins, setWins,
    activity, setActivity,
    // The alerts tab count is always the live sub-alert count, never whatever
    // the summary (or the mock counts) says.
    counts: { ...counts, alerts: alerts.length },
    loading,
    alertsLoading,
    usingMockData,
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
