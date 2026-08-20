"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import { presetToDateRange } from "@/lib/date-utils";
import { bucketSeries } from "@/lib/portfolio-series";
import {
  buildLeadInsight,
  buildLeadKpis,
  granularityFor,
  isLeadRow,
  LEAD_SERIES_CONCURRENCY,
  LEAD_SERIES_PAGE_SIZE,
  normaliseLeadStats,
  previousWindow,
  rowStatus,
} from "@/lib/lead-hub-aggregate";

// ─── Where the Lead Hub's headline figures come from ────────────────────────
//
//   /api/leads/unified  meta.stats over the selected window, and again over the
//                       window before it for the delta pills
//   /api/leads/unified  every row in the selected window, paged, bucketed by
//                       dateAdded into the chart's four curves
//
// The two stats calls ask for a single row each. `meta.stats` is an aggregate
// over the whole window rather than over the page, so a page of one carries
// the same figures as a page of fifteen at a fraction of the payload.
//
// None of them carries a pipeline-stage filter, while the table's own query
// does. The hero describes the period — every lead and contact in it — and the
// tabs beneath choose which of those rows you are looking at. Running the tiles
// through the tab filter as well would make "Total leads" mean "total won
// leads" the moment you opened the Won tab, which is a different figure wearing
// the same label.

// Which tile's movement the chart's headline delta repeats — one number,
// computed once, rather than a second delta that could disagree with the tile
// for the same metric.
const KPI_FOR_METRIC = {
  leads: "leads",
  contacts: "contacts",
  open: "open",
  conversion: "conversionRate",
};

/**
 * @param {string} datePreset the window every figure covers
 * @param {string} selectedClientGroup group id, or "all"
 * @param {string} dateRangeLabel the window's own name, for the chart subtitle
 * @param {boolean} ready false while the group list is still loading
 */
export function useLeadHubData({
  datePreset,
  selectedClientGroup,
  dateRangeLabel = "",
  ready = true,
}) {
  const [current, setCurrent] = useState(null);
  const [previous, setPrevious] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [seriesRows, setSeriesRows] = useState([]);
  const [seriesPartial, setSeriesPartial] = useState(false);
  const [seriesError, setSeriesError] = useState(false);
  const [seriesLoading, setSeriesLoading] = useState(true);

  // "" is how this endpoint spells every group the caller can see.
  const groupsParam = selectedClientGroup && selectedClientGroup !== "all" ? selectedClientGroup : "";

  useEffect(() => {
    // Nothing to ask for, and nothing coming: settle rather than stay pending.
    // These flags start true so the first paint is a loading state, which means
    // returning early here would leave the chart shimmering permanently on any
    // account with no GHL-connected group — a screen that never resolves reads
    // as a screen that was never built.
    if (!ready) {
      setCurrent(null);
      setPrevious(null);
      setStatsLoading(false);
      return;
    }

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

    // Two independent windows, so they go together. Waiting for one before
    // asking for the other doubled the time the hero spent loading for no
    // reason — neither figure is derived from the other.
    setStatsLoading(true);

    statsFor(presetToDateRange(datePreset))
      .then((now) => {
        if (!cancelled) setCurrent(now);
      })
      .catch((err) => {
        if (err.name !== "AbortError" && !cancelled) setCurrent(null);
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });

    // A failed or absent comparison is a fine outcome — the pills just don't
    // render, which is what an unknown delta should look like.
    statsFor(previousWindow(datePreset))
      .then((before) => {
        if (!cancelled) setPrevious(before);
      })
      .catch(() => {
        if (!cancelled) setPrevious(null);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [ready, groupsParam, datePreset]);

  // ── The rows the four curves are bucketed from ──────────────────────────
  useEffect(() => {
    if (!ready) {
      setSeriesRows([]);
      setSeriesPartial(false);
      setSeriesError(false);
      setSeriesLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      setSeriesLoading(true);
      setSeriesError(false);

      const { start_date, end_date } = presetToDateRange(datePreset);
      const pageOf = async (page) => {
        const params = new URLSearchParams({
          groups: groupsParam,
          page: String(page),
          limit: String(LEAD_SERIES_PAGE_SIZE),
        });
        if (start_date) params.set("start_date", start_date);
        if (end_date) params.set("end_date", end_date);

        const res = await apiRequest(`/api/leads/unified?${params}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`leads/unified page ${page} → ${res.status}`);
        return res.json();
      };

      let rows = [];
      let complete = false;

      try {
        const first = await pageOf(1);
        if (cancelled) return;

        rows = first?.contacts ?? [];

        // How many pages there are, from the endpoint's own count. A first
        // page shorter than it was asked for is the whole window whatever meta
        // says, so it costs nothing to check that too.
        const shortPage = rows.length < LEAD_SERIES_PAGE_SIZE;
        const totalPages = shortPage ? 1 : Math.max(Number(first?.meta?.total_pages) || 1, 1);

        // Every remaining page, a poolful at a time — the whole window, but
        // never more than LEAD_SERIES_CONCURRENCY requests in flight.
        for (let page = 2; page <= totalPages; page += LEAD_SERIES_CONCURRENCY) {
          const wave = Array.from(
            { length: Math.min(LEAD_SERIES_CONCURRENCY, totalPages - page + 1) },
            (_, i) => pageOf(page + i)
          );
          const settled = await Promise.all(wave);
          if (cancelled) return;
          rows = settled.reduce((all, p) => all.concat(p?.contacts ?? []), rows);
        }

        complete = true;
        if (!cancelled) setSeriesRows(rows);
      } catch (err) {
        if (err.name === "AbortError") return;
        if (!cancelled) {
          // Whatever pages did arrive are still real rows, but they are no
          // longer the whole window — and a partial curve under an exact total
          // is the thing this chart is not allowed to draw silently.
          setSeriesRows(rows);
          setSeriesPartial(rows.length > 0);
          // Nothing at all is a load failure rather than an empty window. The
          // two looked identical before, which is how a rejected request came
          // to read as "no leads in this window".
          setSeriesError(rows.length === 0);
        }
      } finally {
        if (!cancelled && complete) setSeriesPartial(false);
        if (!cancelled) setSeriesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [ready, groupsParam, datePreset]);

  const kpis = useMemo(() => buildLeadKpis(current, previous), [current, previous]);

  // Read off the same rows the chart is bucketed from, so the sentence and the
  // curve above it describe one set of records.
  const insight = useMemo(
    () => buildLeadInsight(current, previous, seriesRows, seriesPartial),
    [current, previous, seriesRows, seriesPartial]
  );

  const chartMetrics = useMemo(() => {
    const granularity = granularityFor(datePreset);
    const at = (row) => row?.dateAdded;

    // One bucket set, four weightings. Buckets come from the rows rather than
    // from a generated calendar, so every series here shares an axis and the
    // won/lead pair can be divided index by index.
    const leads = bucketSeries(seriesRows, at, granularity, (r) => (isLeadRow(r) ? 1 : 0));
    const contacts = bucketSeries(seriesRows, at, granularity, (r) => (isLeadRow(r) ? 0 : 1));
    const open = bucketSeries(seriesRows, at, granularity, (r) =>
      rowStatus(r) === "open" ? 1 : 0
    );
    const won = bucketSeries(seriesRows, at, granularity, (r) => (rowStatus(r) === "won" ? 1 : 0));

    // Every bucket is a count of real rows — the whole window is read, so
    // nothing here is scaled or inferred. The one case that needs saying is a
    // read that came up short because a page failed: the curve is then genuinely
    // under the total above it, and a chart that under-draws in silence is worse
    // than one that admits it.
    const counted = (series) =>
      seriesPartial
        ? {
            ...series,
            estimated: true,
            estimateNote: "some pages didn't load — this curve is short of the total above",
          }
        : { ...series, estimated: false };

    const totals = current ?? { leads: 0, contacts: 0, open: 0, conversionRate: 0 };

    return {
      leads: {
        tab: "Leads",
        title: "Total leads",
        subtitle: "Lead volume across all client groups",
        total: Math.round(totals.leads).toLocaleString(),
        ...counted(leads),
      },
      contacts: {
        tab: "Contacts",
        title: "Total contacts",
        subtitle: "Contacts captured without a lead form",
        total: Math.round(totals.contacts).toLocaleString(),
        ...counted(contacts),
      },
      open: {
        tab: "Open",
        title: "Open leads",
        subtitle: "Leads still in an open opportunity stage",
        total: Math.round(totals.open).toLocaleString(),
        ...counted(open),
      },
      conversion: {
        tab: "Conversion",
        title: "Conversion rate",
        subtitle: "Share of leads converting to a won opportunity",
        total: `${totals.conversionRate.toFixed(1)}%`,
        decimals: 1,
        valueSuffix: "%",
        // Both sides come from the same rows, so the rate is the window's own.
        values: won.values.map((wins, i) => {
          const denominator = leads.values[i];
          return denominator > 0 ? (wins / denominator) * 100 : 0;
        }),
        labels: leads.labels,
        tooltipLabels: leads.tooltipLabels,
      },
    };
  }, [seriesRows, seriesPartial, datePreset, current]);

  const chartFor = useMemo(
    () => (metricKey) => {
      const metric = chartMetrics[metricKey];
      if (!metric?.values?.length) return null;

      const kpi = kpis.find((k) => k.key === KPI_FOR_METRIC[metricKey]);
      const decimals = metric.decimals ?? 0;

      return {
        ...metric,
        subtitle: dateRangeLabel ? `${dateRangeLabel} · ${metric.subtitle}` : metric.subtitle,
        pointValues: metric.values.map(
          (v) =>
            `${Number(v).toLocaleString(undefined, {
              minimumFractionDigits: decimals,
              maximumFractionDigits: decimals,
            })}${metric.valueSuffix ?? ""}`
        ),
        direction: kpi?.direction,
        delta: kpi?.delta,
        polarity: kpi?.polarity,
      };
    },
    [chartMetrics, kpis, dateRangeLabel]
  );

  return {
    current,
    previous,
    kpis,
    insight,
    chartMetrics,
    chartFor,
    statsLoading,
    seriesLoading,
    seriesError,
    seriesPartial,
    hasComparison: previous != null,
  };
}
