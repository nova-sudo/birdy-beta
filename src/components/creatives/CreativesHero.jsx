"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import useSWR, { mutate as globalMutate } from "swr"
import { BirdyRead, MetricTabsChart, toast } from "@/components/ds"
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
    return dailyTotals(lists)
  }, [data, currency])
}

const fmtDate = (iso) => {
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
}

const TONE = { HIGH: "danger", OPPORTUNITY: "success" }

/** Birdy's open creative suggestions (rule ids starting `creative_`) as BirdyRead findings; apply may send you on to the wizard. */
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

  const metrics = [
    { key: "live", label: "Tests live", value: f.live, plottable: false },
    { key: "spend", label: "Test spend", value: money(f.spend), series: plot("spend") },
    { key: "leads", label: "Leads", value: f.leads, series: plot("leads") },
    { key: "cpl", label: "Blended CPL", value: f.cpl == null ? "—" : `${sym}${f.cpl.toFixed(2)}`, series: plot("cpl") },
    { key: "hook", label: "Hook rate", value: f.hook == null ? "—" : `${f.hook.toFixed(1)}%`, plottable: false },
    { key: "win_rate", label: "Win rate", value: f.win_rate == null ? "—" : `${Math.round(f.win_rate * 100)}%`, plottable: false },
  ].map((m) => ({ ...m, plottable: m.plottable ?? m.series != null }))

  const format = (n, m) => (m.key === "cpl" ? `${sym}${n.toFixed(2)}` : m.key === "spend" ? money(n) : n.toLocaleString("en-GB"))

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <MetricTabsChart
        metrics={metrics}
        value={metric}
        onValueChange={setMetric}
        formatValue={format}
        loading={loading}
        xLabel="Creative tests over time"
        emptyMessage="No daily data yet. Charts fill in after the first tracking run."
        redrawKey={metric}
      />
      <BirdyRead findings={findings} prompt="How are my creative tests doing?" empty="Nothing needs you right now." />
    </div>
  )
}
