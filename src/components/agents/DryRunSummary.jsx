"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { pollJob, startDryRun } from "@/lib/agents-api"
import { prettyLabel } from "@/lib/chat-viz"
import { BirdyRead, DataTable, ErrorState, MetricTabsChart, Spinner, Surface } from "@/components/ds"

export const POLL_MS = 2000
const MAX_POLL_MISSES = 3

const money = (n, symbol) => `${symbol}${Math.round(Number(n) || 0).toLocaleString("en-GB")}`

const COLUMNS = [
  {
    accessorKey: "day",
    header: "Date",
    cell: ({ getValue }) => <span className="font-mono text-xs text-muted-foreground">{prettyLabel(getValue())}</span>,
  },
  { accessorKey: "title", header: "Would have" },
  {
    accessorKey: "client_name",
    header: "Client",
    cell: ({ getValue }) => <span className="text-muted-foreground">{getValue()}</span>,
  },
  {
    accessorKey: "why",
    header: "Why",
    meta: { align: "right" },
    cell: ({ getValue }) => (
      <span className="block text-right text-xs text-muted-foreground tabular-nums">{getValue()}</span>
    ),
  },
]

// The money and lead figures come from pauses only, so their tabs list the pauses.
const PAUSE_ONLY = new Set(["saved", "leads"])

/** Birdy's one line on the result. Only what the numbers say. */
function readOf(result, currency) {
  if (!result) return []
  if (result.actions === 0) {
    return [
      {
        id: "quiet",
        tone: "info",
        title: "Nothing would have fired in the last 30 days",
        detail: "If that seems too quiet, tighten the values in the playbook.",
      },
    ]
  }
  if (result.leads_at_risk > 0) {
    const n = result.leads_at_risk
    return [
      {
        id: "leads",
        tone: "warning",
        title: `${n} ${n === 1 ? "lead" : "leads"} came from ads after the point they'd have been paused`,
        detail: "If you'd rather give ads longer, raise the spend values in Pause ads over target.",
      },
    ]
  }
  if (result.spend_saved > 0) {
    return [
      {
        id: "saved",
        tone: "success",
        title: `It would have saved ${money(result.spend_saved, currency)} without losing a lead`,
        detail: "Every paused ad stayed at zero leads for the rest of the window.",
      },
    ]
  }
  return []
}

/**
 * Starts the 30-day dry run when it mounts (and again when `runKey` changes), polls the job every
 * 2 seconds, then shows the totals as metric tabs over the examples table.
 *
 * @param {object} props
 * @param {string} props.agentId
 * @param {string} [props.currency="$"] Symbol for the spend figure
 * @param {string|number} [props.runKey] Change it to run again (after a rule edit)
 * @param {(result: object) => void} [props.onResult]
 */
export function DryRunSummary({ agentId, currency = "$", runKey = 0, onResult, className }) {
  const [attempt, setAttempt] = React.useState(0)
  const [state, setState] = React.useState({ phase: "running" })
  const [tab, setTab] = React.useState("actions")
  const started = React.useRef(null)
  const onResultRef = React.useRef(onResult)
  onResultRef.current = onResult

  React.useEffect(() => {
    if (!agentId) return undefined
    let cancelled = false
    let timer

    // One start per run, even when strict mode mounts the effect twice.
    const key = `${agentId}:${runKey}:${attempt}`
    if (started.current?.key !== key) started.current = { key, job: startDryRun(agentId) }
    setState((prev) => (prev.phase === "running" ? prev : { phase: "running" }))

    const fail = (error) => {
      if (!cancelled) setState({ phase: "failed", error })
    }

    let misses = 0
    const poll = async (jobId) => {
      try {
        const job = await pollJob(agentId, jobId)
        if (cancelled) return
        misses = 0
        if (job?.status === "done") {
          setState({ phase: "done", result: job.result })
          onResultRef.current?.(job.result)
        } else if (job?.status === "failed") {
          fail(job.error)
        } else {
          timer = setTimeout(() => poll(jobId), POLL_MS)
        }
      } catch (e) {
        // A network blip is not a failed run: give up only after a few misses in a row.
        misses += 1
        if (cancelled) return
        if (misses < MAX_POLL_MISSES) timer = setTimeout(() => poll(jobId), POLL_MS)
        else fail(e?.message)
      }
    }

    started.current.job.then(
      (res) => {
        if (!cancelled) poll(res?.job_id)
      },
      (e) => fail(e?.message)
    )

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [agentId, runKey, attempt])

  if (state.phase === "failed") {
    return (
      <Surface className={className}>
        <ErrorState
          title="The dry run didn't finish"
          description={
            state.error === "timed_out"
              ? "It took longer than 10 minutes. Try again in a moment."
              : "Something went wrong replaying your data."
          }
          onRetry={() => setAttempt((n) => n + 1)}
        />
      </Surface>
    )
  }

  const result = state.phase === "done" ? state.result : null
  const loading = !result
  const examples = result?.examples ?? []
  const rows = PAUSE_ONLY.has(tab) ? examples.filter((e) => e.rule_kind === "pause_over_target") : examples

  const metrics = [
    {
      key: "actions",
      label: "Actions suggested",
      value: result ? String(result.actions) : "",
      caption: "over 30 days",
      plottable: true,
    },
    {
      key: "saved",
      label: "Spend it would have saved",
      value: result ? money(result.spend_saved, currency) : "",
      caption: "on ads it would have paused",
      plottable: true,
    },
    {
      key: "leads",
      label: "Leads at risk",
      value: result ? String(result.leads_at_risk) : "",
      caption: "from paused ads",
      plottable: true,
    },
  ]

  return (
    <div data-slot="dry-run-summary" className={cn("flex min-w-0 flex-col gap-6", className)}>
      <div className="flex flex-col gap-2">
        <MetricTabsChart
          metrics={metrics}
          value={tab}
          onValueChange={setTab}
          loading={loading}
          plotFallback={
            <div className="w-full self-stretch">
              <DataTable
                bare
                columns={COLUMNS}
                data={rows}
                getRowId={(row, i) => `${row.day}-${row.rule_kind}-${i}`}
                empty={
                  <p className="text-center text-sm text-muted-foreground">
                    {PAUSE_ONLY.has(tab) ? "No pauses in the last 30 days." : "Nothing would have changed in the last 30 days."}
                  </p>
                }
              />
            </div>
          }
        />
        {result && result.clients_used < result.clients_total && (
          <p className="text-sm text-muted-foreground">
            Based on {result.clients_used} of {result.clients_total} clients
          </p>
        )}
        {loading && (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner size={14} />
            Replaying the last 30 days of your data. Nothing is changed in Meta.
          </p>
        )}
      </div>
      {result && readOf(result, currency).length > 0 && <BirdyRead findings={readOf(result, currency)} />}
    </div>
  )
}
