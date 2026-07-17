"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import {
  MOCK_SUGGESTIONS,
  MOCK_ALERTS,
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
//     → { suggestions: [...], alerts: [...], wins: [...], activity: [...],
//         counts: { suggestions, alerts, wins } }
//   POST   /api/dashboard/suggestions/:id/apply
//   DELETE /api/dashboard/suggestions/:id
//   POST   /api/dashboard/alerts/:id/action   body: { action: "open_client" | "view_all" }
//   POST   /api/dashboard/wins/:id/complete

export function useDashboardData() {
  const [suggestions, setSuggestions] = useState(MOCK_SUGGESTIONS);
  const [alerts, setAlerts] = useState(MOCK_ALERTS);
  const [wins, setWins] = useState(MOCK_WINS);
  const [activity, setActivity] = useState(MOCK_ACTIVITY);
  const [counts, setCounts] = useState(MOCK_TAB_COUNTS);
  const [loading, setLoading] = useState(true);
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
        setAlerts(data.alerts ?? MOCK_ALERTS);
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

  return {
    suggestions, setSuggestions,
    alerts, setAlerts,
    wins, setWins,
    activity,
    counts,
    loading,
    usingMockData,
  };
}

// ─── Actions ────────────────────────────────────────────────────────────────
// Each fires the real request first; if the endpoint isn't live yet the
// caller still gets a resolved promise so the optimistic UI update proceeds.

export async function applySuggestion(id) {
  try {
    const res = await apiRequest(`/api/dashboard/suggestions/${id}/apply`, { method: "POST" });
    return res.ok;
  } catch {
    return false;
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

export async function runAlertAction(id, action) {
  try {
    const res = await apiRequest(`/api/dashboard/alerts/${id}/action`, {
      method: "POST",
      body: JSON.stringify({ action }),
    });
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
