"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import useSWR, { mutate as globalMutate } from "swr"
import { toast } from "@/components/ds"
import { BirdyBriefing, MetricTabsChart } from "@/components/portfolio"
import { applyWorkItem } from "@/lib/agents-api"
import { currencySymbol } from "@/lib/chat-viz"
import { dailyTotals } from "@/lib/creative-days"
import { useCreativeTests } from "@/lib/creatives-api"
import { fetcher } from "@/lib/fetcher"
import { queryKeys } from "@/lib/query-keys"

const num = (v) => (v != null && Number.isFinite(Number(v)) ? Number(v) : null)
const sum = (tests, key) => tests.reduce((a, t) => a + (num(t.summary?.[key]) ?? 0), 0)

// Day series are fetched for at most this many live tests (one detail call each).
const SERIES_TESTS = 12

/** The six hero figures from the tests' summaries (money already in the user's currency). */
export function heroFigures(tests) {
  const live = tests.filter((t) => t.status === "testing")
  const spend = sum(tests, "spend")
  const leads = sum(tests, "leads")
  const hooks = live.map((t) => num(t.summary?.hook_rate)).filter((v) => v != null)
  const won = tests.filter((t) => t.status === "winner").length
  const lost = tests.filter((t) => t.status === "loser").length
  return {
    live: live.length,
    spend,
    leads,
    cpl: leads > 0 ? spend / leads : null,
    hook: hooks.length ? hooks.reduce((a, b) => a + b, 0) / hooks.length : null,
    win_rate: won + lost > 0 ? won / (won + lost) : null,
  }
}

/** Per-date spend, leads and CPL summed over the live tests' ads that report in the user's currency. */
function useLiveSeries(tests, currency) {
  const ids = tests
    .filter((t) => t.status === "testing")
    .slice(0, SERIES_TESTS)
    .map((t) => t.id)
  const { data } = useSWR(ids.length ? ["creative-hero-days", ...ids] : null, ([, ...list]) =>
    Promise.allSettled(list.map((id) => fetcher(queryKeys.creative(id)))).then((rs) =>
      rs.filter((r) => r.status === "fulfilled").map((r) => r.value)
    )
  )
  return React.useMemo(() => {
    const lists = []
    for (const t of data ?? []) {
      for (const ad of t?.ads ?? []) {
        // Days are in the ad's own currency; summing across currencies would be wrong, so skip others.
        if ((ad.currency ?? currency) !== currency) continue
        lists.push(t.days?.[ad.meta?.ad_id])
      }
    }
    // Tests live per day: tests with spend that date, whatever the ads' currency.
    const liveByDate = new Map()
    for (const t of data ?? []) {
      const dates = new Set()
      for (const rows of Object.values(t?.days ?? {}))
        for (const d of rows ?? []) if (d?.date && Number(d.spend) > 0) dates.add(d.date)
      for (const date of dates) liveByDate.set(date, (liveByDate.get(date) ?? 0) + 1)
    }
    const totals = new Map(dailyTotals(lists).map((p) => [p.date, p]))
    for (const date of liveByDate.keys()) if (!totals.has(date)) totals.set(date, { date })
    return [...totals.values()]
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .map((p) => ({ ...p, live: liveByDate.get(p.date) ?? 0 }))
  }, [data, currency])
}

const fmtDate = (iso) => {
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
}

const TONE = { HIGH: "danger", OPPORTUNITY: "success" }

/** Birdy's open creative suggestions (rule ids starting `creative_`) as findings; apply may send you on to the wizard. */
function useCreativeFindings() {
  const router = useRouter()
  const { data } = useSWR(queryKeys.dashboardSummary(), fetcher)
  return React.useMemo(() => {
    const apply = async (s) => {
      try {
        const r = await applyWorkItem(s.id)
        if (r && r.ok === false) {
          toast.warning("Not done", { description: r.blocked_reason?.message ?? s.title })
          return
        }
        if (typeof r?.redirect === "string" && r.redirect) {
          router.push(r.redirect)
          return
        }
        toast.success("Done", { description: s.title })
        globalMutate(queryKeys.dashboardSummary())
      } catch (err) {
        toast.error("Couldn't apply that", { description: err?.message ?? s.title })
      }
    }
    return (data?.suggestions ?? [])
      .filter((s) => String(s.rule_id ?? "").startsWith("creative_"))
      .map((s) => ({
        id: s.id,
        tone: TONE[s.severity] ?? "warning",
        title: s.title,
        detail: s.description ?? s.why,
        action: { label: "Do it", onClick: () => apply(s) },
      }))
  }, [data, router])
}

/**
 * The Creatives tab's hero: six figures as chart tabs, and Birdy's read of the tests.
 * @param {object} props
 * @param {object[]} [props.tests] Defaults to the owner's tests (optionally for `clientGroupId`)
 * @param {object[]} [props.findings] Findings for Birdy's read; defaults to the open `creative_` suggestions
 */
export function CreativesHero({ tests: given, clientGroupId, findings: givenFindings }) {
  const own = useCreativeTests({ clientGroupId: clientGroupId && clientGroupId !== "all" ? clientGroupId : undefined })
  const tests = given ?? own.tests
  const loading = given ? false : own.isLoading
  const currency = tests.find((t) => t.summary?.currency)?.summary?.currency ?? "GBP"
  const [metric, setMetric] = React.useState("live")
  const f = heroFigures(tests)
  const series = useLiveSeries(tests, currency)
  const fromDashboard = useCreativeFindings()
  const findings = givenFindings ?? fromDashboard

  const sym = currencySymbol(currency)
  const money = (v) => (v == null ? "—" : `${sym}${Math.round(v).toLocaleString("en-US")}`)
  const plot = (key) => {
    const points = series.filter((p) => p[key] != null).map((p) => ({ x: fmtDate(p.date), current: p[key] }))
    return points.length > 1 ? points : undefined
  }

  const tabs = [
    { key: "live", label: "Tests live", value: f.live },
    { key: "spend", label: "Test spend", value: money(f.spend) },
    { key: "leads", label: "Leads", value: f.leads },
    { key: "cpl", label: "Blended CPL", value: f.cpl == null ? "—" : `${sym}${f.cpl.toFixed(2)}` },
    { key: "hook", label: "Hook rate", value: f.hook == null ? "—" : `${f.hook.toFixed(1)}%`, plottable: false },
    { key: "win_rate", label: "Win rate", value: f.win_rate == null ? "—" : `${Math.round(f.win_rate * 100)}%`, plottable: false },
  ]

  const format = (n) => (metric === "cpl" ? `${sym}${n.toFixed(2)}` : metric === "spend" ? money(n) : n.toLocaleString("en-GB"))
  const points = plot(metric)
  const chart = points
    ? {
        title: tabs.find((t) => t.key === metric).label,
        subtitle: "Creative tests over time",
        values: points.map((p) => p.current),
        labels: points.map((p, i) => (i % Math.max(1, Math.ceil(points.length / 8)) === 0 || i === points.length - 1 ? p.x : "")),
        tooltipLabels: points.map((p) => p.x),
        pointValues: points.map((p) => format(p.current)),
      }
    : null

  const count = findings.length
  const parts = count
    ? [{ text: `${count} ${count === 1 ? "thing needs" : "things need"} you on your creative tests.` }]
    : [{ text: "Nothing needs you right now." }]
  const briefing = findings.map((x) => ({
    tone: x.tone,
    parts: [{ text: /[.!?]$/.test(x.title) ? x.title : `${x.title}.`, strong: true }, ...(x.detail ? [{ text: ` ${x.detail}` }] : [])],
    action: x.action,
  }))

  return (
    <div className="grid min-w-0 gap-[14px] lg:grid-cols-[minmax(0,1fr)_320px]">
      <MetricTabsChart
        tabs={tabs}
        activeKey={metric}
        onChange={setMetric}
        chart={chart}
        loading={loading}
        emptyMessage="No daily data yet. Charts fill in after the first tracking run."
        redrawKey={metric}
        layoutId="creatives-hero"
      />
      <BirdyBriefing parts={parts} findings={briefing} prompt="How are my creative tests doing?" />
    </div>
  )
}
