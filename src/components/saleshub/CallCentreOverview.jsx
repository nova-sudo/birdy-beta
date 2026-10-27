"use client"

// components/saleshub/CallCentreOverview.jsx
// The hero above the call-centre table: the six figures as tabs over the
// trend of whichever is selected, and Birdy's read of the window beside it.
//
// Extracted from the Sales Hub page so /clients/[id]'s Call Centre tab can
// draw the same thing scoped to one client. It was page-only, which is why
// that tab showed a bare table while the Marketing tab — whose equivalent row
// lives inside MarketingContent — looked finished.

import { useMemo, useState } from "react"
import { BirdyBriefing, CALL_CHART_LOADING, LoadError, MetricTabsChart } from "@/components/portfolio"
import { buildSalesFindings, buildSalesInsight, insightPrompt } from "@/lib/saleshub-insight"
import { formatTotal, sumCallStats } from "@/lib/saleshub-totals"
import { DATE_PRESETS } from "@/lib/constants"
import { KPI_PRESENTATION } from "@/app/Sales-Hub/presentation"
import { useSalesHubSeries } from "@/app/Sales-Hub/useSalesHubSeries"
import { groupsWithoutCallCentre, scopeHasCallCentre } from "@/lib/call-centre-availability"
import { CallCentreUnavailable, UnavailableValue } from "@/components/callcenter/CallCentreUnavailable"

const presetLabel = (preset) =>
  DATE_PRESETS.find((p) => p.value === preset)?.label ?? "Selected period"

// Chart on the left, Birdy on the right, at a width that keeps three findings
// readable without the plot giving up more than it must.
const HERO_GRID = "mb-[18px] grid min-w-0 gap-[14px] lg:grid-cols-[minmax(0,1fr)_320px]"

// The six figures with no numbers behind them. The row stays — the reader
// still needs to know which six figures Birdy would be showing them — but each
// value is the placeholder and nothing is selectable, since there is no curve
// to open. Blanking the card instead would answer a question nobody asked
// ("what would I get?") with silence.
const UNAVAILABLE_TABS = KPI_PRESENTATION.map((tile) => ({
  key: tile.key,
  label: tile.label,
  value: <UnavailableValue />,
  tone: "neutral",
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

  const tabs = useMemo(
    () =>
      KPI_PRESENTATION.map((tile) => ({
        key: tile.key,
        label: tile.label,
        value: formatTotal(tile.key, totals[tile.key] ?? 0),
        tone: tile.tone,
        plottable: Boolean(tile.chartKey),
      })),
    [totals]
  )

  const activeTile = KPI_PRESENTATION.find((tile) => tile.key === activeTab)
  const metric = activeTile?.chartKey ? chartMetrics[activeTile.chartKey] : null

  // The design's subtitle reads "<Date range> · <metric sub>", so the chart
  // always says which window it is drawing. The plotted note only appears when
  // the curve's sum and the figure above it disagree — which they do for
  // "Leads called", whose only series is the first-contact cohort rather than
  // the distinct-leads count the tab shows. The plot header then says so
  // rather than leaving the reader to add up the points and wonder.
  const chart = metric && {
    ...metric,
    subtitle: `${presetLabel(datePreset)} · ${metric.subtitle}`,
    plottedNote: activeTile.chartKey !== activeTile.key ? `Plotted: ${metric.total}` : undefined,
  }

  // A failed fetch must not read as a quiet week: every figure below sums an
  // empty list to 0, and nothing else on the page says why.
  if (groupsError) {
    return <LoadError className="mb-[18px]" error={groupsError} onRetry={onRetry} />
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
          tabs={UNAVAILABLE_TABS}
          activeKey={null}
          chart={null}
          layoutId="sales-hub-hero"
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
        tabs={tabs}
        activeKey={activeTab}
        onChange={setActiveTab}
        chart={chart}
        loading={groupsLoading}
        plotLoading={seriesLoading || Boolean(metric?.pending)}
        loadingStatements={CALL_CHART_LOADING}
        emptyMessage={
          totals.calls > 0
            ? "No dated calls in this window yet."
            : "No calls logged in this window yet."
        }
        // Keying on metric + window remounts the paths, which is what makes
        // the draw and fade animations replay on every switch.
        redrawKey={`${activeTab}-${datePreset}-${granularity}-${selectedClientGroup}`}
        layoutId="sales-hub-hero"
      />
      <BirdyBriefing parts={insight} findings={findings} prompt={insightPrompt(insight)} />
    </div>
  )
}
