"use client";

import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import {
  ACTIVITY,
  ACTIVITY_TOTAL,
  CALL_INSIGHTS,
  CHART_AXIS,
  CHART_METRICS,
  FUNNEL_STAGES,
  KPIS,
  SUGGESTIONS,
  TOP_CLIENTS,
  TOP_CLIENT_METRICS,
} from "./fixtures";

// ─── Backend contract ──────────────────────────────────────────────────────
//
//   GET    /api/portfolio/summary
//   POST   /api/portfolio/suggestions/:id/apply
//   DELETE /api/portfolio/suggestions/:id
//
// The summary returns every timeframe in one payload rather than one request
// per timeframe. Switching Daily/Weekly/Monthly is a chart redraw the user
// expects to be instant, and a round trip per switch would put a spinner in the
// middle of the one interaction this screen is built around.
//
//   {
//     clientCount: 55,
//     dateRange: "1 – 31 Jul 2026",
//     kpis:        { spend: { label, icon, polarity, Monthly: { value, direction, delta }, … }, … },
//     chartMetrics:{ leads: { tab, title, subtitle, scale, prefix?, Monthly: [...], totals: {…} }, … },
//     chartAxis:   { Monthly: [...], Weekly: [...], Daily: [...] },
//     topClients:  { "Avg CPL": [ { name, meta, bar, value, direction, delta } ], … },
//     funnel:      [ { key, stage, count, direction, delta, issue, stageNoun } ],
//     callInsights:[ { key, label, value, direction, delta, polarity, icon } ],
//     suggestions: [ { id, severity, client, title, why } ],
//     activity:    [ { id, action, client, mode, time } ],
//     activityCount: 14,
//   }

const SUMMARY_ENDPOINT = "/api/portfolio/summary";

// The screen was built against the handoff's figures, and they stay useful for
// reviewing it before the endpoint exists. They are development-only on
// purpose: this repo's dashboard hook already holds the line that a live page
// shows an empty state rather than invented numbers, and invented numbers are
// worse here than anywhere — an agency owner would be reading named clients and
// spend figures that are not theirs.
const ALLOW_FIXTURES = process.env.NODE_ENV !== "production";

const FIXTURE_PAYLOAD = {
  clientCount: 55,
  dateRange: "1 – 31 Jul 2026",
  kpis: KPIS,
  chartMetrics: CHART_METRICS,
  chartAxis: CHART_AXIS,
  topClients: TOP_CLIENTS,
  topClientMetrics: TOP_CLIENT_METRICS,
  funnel: FUNNEL_STAGES,
  callInsights: CALL_INSIGHTS,
  suggestions: SUGGESTIONS,
  activity: ACTIVITY,
  activityCount: ACTIVITY_TOTAL,
};

const EMPTY_PAYLOAD = {
  clientCount: null,
  dateRange: "",
  kpis: {},
  chartMetrics: {},
  chartAxis: {},
  topClients: {},
  topClientMetrics: [],
  funnel: [],
  callInsights: [],
  suggestions: [],
  activity: [],
  activityCount: 0,
};

export function usePortfolioData() {
  const [data, setData] = useState(EMPTY_PAYLOAD);
  const [loading, setLoading] = useState(true);
  // Distinct from "loaded but empty": the endpoint isn't answering, so the page
  // says so rather than implying the portfolio has no clients.
  const [unavailable, setUnavailable] = useState(false);
  const [usingFixtures, setUsingFixtures] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await apiRequest(SUMMARY_ENDPOINT);
        if (!res.ok) throw new Error(`GET ${SUMMARY_ENDPOINT} → ${res.status}`);
        const payload = await res.json();
        if (cancelled) return;

        setData({ ...EMPTY_PAYLOAD, ...payload });
        setUnavailable(false);
        setUsingFixtures(false);
      } catch {
        if (cancelled) return;

        if (ALLOW_FIXTURES) {
          setData(FIXTURE_PAYLOAD);
          setUsingFixtures(true);
          setUnavailable(false);
        } else {
          setData(EMPTY_PAYLOAD);
          setUnavailable(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Applying moves the suggestion into the feed. The optimistic update runs
  // first and is rolled back on failure, so the rail never stalls on a request
  // the user has already decided about.
  const applySuggestion = useCallback(async (suggestion) => {
    const entry = {
      id: `applied-${suggestion.id}`,
      action: suggestion.title,
      client: suggestion.client,
      mode: "Approved",
      time: "just now",
    };

    setData((prev) => ({
      ...prev,
      suggestions: prev.suggestions.filter((s) => s.id !== suggestion.id),
      activity: [entry, ...prev.activity],
      activityCount: prev.activityCount + 1,
    }));

    try {
      const res = await apiRequest(`/api/portfolio/suggestions/${suggestion.id}/apply`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`apply → ${res.status}`);
      return true;
    } catch {
      setData((prev) => ({
        ...prev,
        suggestions: prev.suggestions.some((s) => s.id === suggestion.id)
          ? prev.suggestions
          : [suggestion, ...prev.suggestions],
        activity: prev.activity.filter((a) => a.id !== entry.id),
        activityCount: Math.max(prev.activityCount - 1, 0),
      }));
      return false;
    }
  }, []);

  // Dismissing is not an action on the ad platform, so nothing joins the feed.
  const dismissSuggestion = useCallback(async (suggestion) => {
    setData((prev) => ({
      ...prev,
      suggestions: prev.suggestions.filter((s) => s.id !== suggestion.id),
    }));

    try {
      const res = await apiRequest(`/api/portfolio/suggestions/${suggestion.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`dismiss → ${res.status}`);
      return true;
    } catch {
      setData((prev) => ({
        ...prev,
        suggestions: prev.suggestions.some((s) => s.id === suggestion.id)
          ? prev.suggestions
          : [suggestion, ...prev.suggestions],
      }));
      return false;
    }
  }, []);

  return { ...data, loading, unavailable, usingFixtures, applySuggestion, dismissSuggestion };
}
