"use client"

// components/saleshub/CallCentreOverview.jsx
// The hero above the call-centre table: the five figures as tabs over the
// trend of whichever is selected, and Birdy's read of the window beside it.
//
// Extracted from the Sales Hub page so /clients/[id]'s Call Centre tab can
// draw the same thing scoped to one client. It was page-only, which is why
// that tab showed a bare table while the Marketing tab — whose equivalent row
// lives inside MarketingContent — looked finished.

import { useMemo, useState } from "react"
import { BirdyRead, ErrorState, MetricTabsChart } from "@/components/ds"
import { buildSalesFindings, buildSalesInsight, insightPrompt } from "@/lib/saleshub-insight"
import { formatTotal, sumCallStats } from "@/lib/saleshub-totals"
import { DATE_PRESETS } from "@/lib/constants"
import { KPI_PRESENTATION } from "@/app/Sales-Hub/presentation"
import { toLeadFindings, toTrendSeries } from "@/app/contacts/presentation"
import { useSalesHubSeries } from "@/app/Sales-Hub/useSalesHubSeries"
import { groupsWithoutCallCentre, scopeHasCallCentre } from "@/lib/call-centre-availability"
import { CallCentreUnavailable, UnavailableValue } from "@/components/callcenter/CallCentreUnavailable"

const presetLabel = (preset) =>
  DATE_PRESETS.find((p) => p.value === preset)?.label ?? "Selected period"

// Chart on the left, Birdy on the right, at a width that keeps three findings
// readable without the plot giving up more than it must.
const HERO_GRID = "grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]"

// The figures with no numbers behind them. The row stays — the reader still
// needs to know which figures Birdy would be showing them — but each value is
// the placeholder and nothing is selectable, since there is no curve to open.
const UNAVAILABLE_METRICS = KPI_PRESENTATION.map((tile) => ({
  key: tile.key,
  label: tile.label,
  value: <UnavailableValue />,
  plottable: false,
}))

/**
 * @param {string} [granularity] Daily | Weekly | Monthly, from the hub's
 *   granularity chip. Omitted — as it is on /clients/[id], which carries no
 *   chip — the date window picks for itself. See useSalesHubSeries.
 */
export function CallCentreOverview({
  clientGroups,
  groupsLoading,
  datePreset,
  selectedClientGroup = "all",
  granularity,
  groupsError,
  onRetry,
}) {
  // Keyed by figure (presentation key), not by series: the tab is what the
  // reader clicked, and presentation.js says which curve that opens.
  const [activeTab, setActiveTab] = useState("calls")

  // Everything below this line is a sum over HotProspector caches. A client
  // who told us at onboarding that they don't call their leads has none of
  // those caches, so every sum lands on a well-formatted 0 — indistinguishable
  // from a quiet week, and meaning the opposite of one. See
  // lib/call-centre-availability.js.
  const available = useMemo(
    () => scopeHasCallCentre(clientGroups, selectedClientGroup),
    [clientGroups, selectedClientGroup]
  )

  const totals = useMemo(
    () => sumCallStats(clientGroups, selectedClientGroup, datePreset),
    [clientGroups, selectedClientGroup, datePreset]
  )
  const insight = useMemo(() => buildSalesInsight(totals), [totals])
  const findings = useMemo(
    () => buildSalesFindings(clientGroups, selectedClientGroup, datePreset),
    [clientGroups, selectedClientGroup, datePreset]
  )

  const { chartMetrics, loading: seriesLoading } = useSalesHubSeries({
    clientGroups,
    groupsLoading,
    datePreset,
    selectedClientGroup,
    granularity,
  })

  // Every figure carries its own series, so switching tabs needs no refetch.
  // The caption names the window; "Leads called" also says what its curve
  // counts, because the only series the backend keeps for it is the
  // first-contact cohort rather than the distinct-leads figure on the tab.
  const metrics = useMemo(
    () =>
      KPI_PRESENTATION.map((tile) => {
        const source = tile.chartKey ? chartMetrics[tile.chartKey] : null
        const differs = tile.chartKey !== tile.key
        return {
          key: tile.key,
          label: tile.label,
          value: formatTotal(tile.key, totals[tile.key] ?? 0),
          plottable: Boolean(tile.chartKey),
          series: toTrendSeries(source),
          caption: differs && source ? `Curve: first contacts, ${source.total}` : presetLabel(datePreset),
        }
      }),
    [totals, chartMetrics, datePreset]
  )

  const activeTile = KPI_PRESENTATION.find((tile) => tile.key === activeTab)
  const activeSource = activeTile?.chartKey ? chartMetrics[activeTile.chartKey] : null
  const readRows = useMemo(
    () => toLeadFindings(insight, findings, { empty: !totals.calls }),
    [insight, findings, totals.calls]
  )
  const insightText = insight.map((p) => p.text).join("")

  // A failed fetch must not read as a quiet week: every figure below sums an
  // empty list to 0, and nothing else on the page says why.
  if (groupsError) {
    return (
      <ErrorState
        title="Couldn't load your client data"
        description={`${String(groupsError).replace(/\.+$/, "")}. The figures here are missing, not zero.`}
        onRetry={onRetry}
      />
    )
  }

  // The same two columns, so switching clients doesn't reflow the page — the
  // figures keep their labels but lose their numbers, and the explanation
  // takes Birdy's seat. The briefing is the one thing that goes: its copy is
  // generated from these totals, so leaving it in would have Birdy narrating
  // a week that was never measured.
  if (!available && !groupsLoading) {
    return (
      <div className={HERO_GRID}>
        <MetricTabsChart
          metrics={UNAVAILABLE_METRICS}
          value={null}
          emptyMessage="No call centre is linked for this client, so there are no calls to plot."
        />
        <CallCentreUnavailable
          className="min-w-0"
          groupIds={groupsWithoutCallCentre(clientGroups, selectedClientGroup)}
          onSwitched={onRetry}
        />
      </div>
    )
  }

  return (
    <div className={HERO_GRID}>
      <MetricTabsChart
        metrics={metrics}
        value={activeTab}
        onValueChange={setActiveTab}
        xLabel={`${activeSource?.title ?? activeTile?.label ?? "Metric"} · ${presetLabel(datePreset)}`}
        loading={groupsLoading}
        plotLoading={seriesLoading || Boolean(activeSource?.pending)}
        emptyMessage={
          activeSource?.values?.length === 1
            ? "Pick 7 days or longer to see a trend."
            : totals.calls > 0
              ? "No dated calls in this window yet."
              : "No calls logged in this window yet."
        }
      />
      <BirdyRead findings={readRows} empty={insightText} prompt={insightPrompt(insight)} />
    </div>
  )
}
