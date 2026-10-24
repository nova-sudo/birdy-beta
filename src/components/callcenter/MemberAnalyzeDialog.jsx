"use client"

import { useEffect, useState } from "react"
import { AlertTriangleIcon, BellIcon, CoinsIcon, SparklesIcon } from "lucide-react"

import {
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Skeleton,
  Spinner,
} from "@/components/ds"
import { apiRequest } from "@/lib/api"
import { BirdyRow, ProgressBar, StatTile } from "./CallCentreParts"
import {
  MEMBER_ANALYSIS_BATCH,
  MEMBER_ANALYSIS_MAX,
  memberRuns,
  outcomeTone,
  parseOutcome,
  resetMemberRun,
  startMemberAnalysis,
  subscribeMemberRuns,
} from "./analysis"

// ── Member AI analysis (Members tab: "analyze this agent's last N calls") ────
// Three steps in one Dialog: Estimate (cost shown before the confirm button
// does anything) → Running (progress; closing keeps it running, see the run
// store in analysis.js) → Results (stat tiles and a per-call list).

const DIALOG_CLASS = "max-h-[85dvh] gap-0 overflow-hidden p-0 sm:max-w-xl grid-rows-[auto_minmax(0,1fr)_auto]"

const batchSizes = (count) => {
  const sizes = []
  for (let left = count; left > 0; left -= MEMBER_ANALYSIS_BATCH) sizes.push(Math.min(MEMBER_ANALYSIS_BATCH, left))
  return sizes
}

function EstimateStep({ id, name, countInput, setCountInput, estimating, estimate, count }) {
  const found = estimate?.calls_found ?? 0
  const sizes = batchSizes(Math.min(count, found))
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor={id}>
          Last how many calls? (1–{MEMBER_ANALYSIS_MAX})
        </Label>
        <Input
          id={id}
          type="number"
          min={1}
          max={MEMBER_ANALYSIS_MAX}
          value={countInput}
          onChange={(e) => setCountInput(e.target.value)}
          className="w-32"
        />
      </div>

      <div className="rounded-surface bg-muted px-4 py-3">
        {estimating ? (
          <div className="flex flex-col gap-2" aria-hidden="true">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-64" />
          </div>
        ) : estimate ? (
          found === 0 ? (
            <span className="text-sm text-muted-foreground">No recorded calls found for {name}.</span>
          ) : (
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-primary-soft text-primary">
                <CoinsIcon className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="num text-base font-semibold text-foreground">
                  ~{estimate.estimated_credits} credits
                  <span className="ml-2 text-xs font-normal text-muted-foreground">estimated</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {found} recorded {found === 1 ? "call" : "calls"}
                  {found < estimate.requested && ` (only ${found} of ${estimate.requested} requested exist)`}
                  {" · "}
                  {estimate.total_minutes} min of audio
                  {estimate.already_transcribed > 0 && ` · ${estimate.already_transcribed} already transcribed (free)`}
                </p>
                <p className="text-sm text-muted-foreground">
                  {sizes.length} {sizes.length === 1 ? "batch" : "batches"} ({sizes.join(" · ")})
                </p>
              </div>
            </div>
          )
        ) : (
          <span className="text-sm text-muted-foreground">Couldn&apos;t fetch a cost estimate.</span>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Recordings are transcribed and reviewed by AI. You can close this window while it runs — you&apos;ll be notified
        when the analysis is done.
      </p>
    </div>
  )
}

function RunningStep({ run, name }) {
  const batch = Math.min(Math.floor(run.done / MEMBER_ANALYSIS_BATCH) + 1, Math.ceil(run.total / MEMBER_ANALYSIS_BATCH))
  const batches = Math.ceil(run.total / MEMBER_ANALYSIS_BATCH)
  return (
    <div className="flex flex-col gap-4">
      <BirdyRow state="loading">
        <span className="text-sm font-medium text-muted-foreground">
          Analyzing calls… {run.done}/{run.total}
        </span>
      </BirdyRow>
      <div className="flex flex-col gap-2">
        <ProgressBar value={run.done} max={run.total} label={`Analysis progress for ${name}`} />
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Transcribing and reviewing recordings</span>
          <span className="num">
            Batch {batch} of {batches}
          </span>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Feel free to close this window — you&apos;ll be notified when it&apos;s done.
      </p>
    </div>
  )
}

function ResultsStep({ run, analyzed, outcomes }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <StatTile value={analyzed.length} label="Calls analyzed" />
        <StatTile value={outcomes.appointment_set || 0} label="Appointments set" />
        <StatTile value={outcomes.callback_promised || 0} label="Callbacks promised" />
        <StatTile value={outcomes.no_answer || 0} label="No answer" />
      </div>

      <BirdyRow>
        {Object.entries(outcomes).map(([o, n]) => (
          <Badge key={o} tone={outcomeTone(o)}>
            {o.replace(/_/g, " ")}: {n}
          </Badge>
        ))}
        {run.failed > 0 && <Badge tone="danger">{run.failed} failed to transcribe</Badge>}
      </BirdyRow>

      <ul className="flex flex-col gap-2">
        {run.calls.map((c) => {
          const outcome = c.summary ? parseOutcome(c.summary) : null
          return (
            <li key={c.call_id} className="rounded-surface bg-muted px-4 py-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {c.started_at ? new Date(c.started_at).toLocaleString() : "—"}
                  {c.lead_name && ` · ${c.lead_name}`}
                  {c.duration_seconds != null && ` · ${Math.floor(c.duration_seconds / 60)}m ${c.duration_seconds % 60}s`}
                </p>
                {outcome && <Badge tone={outcomeTone(outcome)}>{outcome.replace(/_/g, " ")}</Badge>}
              </div>
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                {c.summary ? (
                  c.summary.replace(/\n?OUTCOME:.*$/i, "").trim()
                ) : (
                  <span className="text-danger-ink">{c.error}</span>
                )}
              </p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * The Members tab's Analyze button and its three-step Dialog.
 *
 * @param {object} props
 * @param {{id?: string, name: string}} props.member A members row
 */
export function MemberAnalyzeDialog({ member }) {
  const [open, setOpen] = useState(false)
  const [countInput, setCountInput] = useState("10")
  const [estimate, setEstimate] = useState(null)
  const [estimating, setEstimating] = useState(false)
  const [, forceRerender] = useState(0)

  const name = member.name && member.name !== "—" ? member.name : null
  const run = name ? memberRuns.get(name) : null
  const count = Math.min(MEMBER_ANALYSIS_MAX, Math.max(1, Number(countInput) || 10))

  // Re-render on run-store updates (progress ticks, completion) while mounted:
  // the trigger shows the live count even with the dialog closed.
  useEffect(() => subscribeMemberRuns(() => forceRerender((n) => n + 1)), [])

  // Debounced cost estimate — refetched when the dialog opens or N changes.
  useEffect(() => {
    if (!open || !name) return
    let cancelled = false
    setEstimating(true)
    const t = setTimeout(async () => {
      try {
        const res = await apiRequest(
          `/api/call-analysis/member/estimate?agent_name=${encodeURIComponent(name)}&limit=${count}`,
        )
        const data = res.ok ? await res.json() : null
        if (!cancelled) setEstimate(data)
      } catch {
        if (!cancelled) setEstimate(null)
      } finally {
        if (!cancelled) setEstimating(false)
      }
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [open, name, count])

  if (!name) return <span className="text-sm text-muted-foreground">—</span>

  const running = run?.status === "running"
  const analyzed = (run?.calls || []).filter((c) => c.summary)
  const outcomes = analyzed.reduce((acc, c) => {
    const o = parseOutcome(c.summary) || "other"
    acc[o] = (acc[o] || 0) + 1
    return acc
  }, {})

  const toAnalyze = Math.min(count, estimate?.calls_found ?? count)
  const subtitle = running
    ? `Transcribing and reviewing ${name}'s recordings.`
    : run?.status === "done"
      ? `${analyzed.length} of ${run.total} recent calls analyzed.`
      : run?.status === "error"
        ? "The analysis didn't finish."
        : `Pick how many of ${name}'s recent calls to review.`

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          {running ? <Spinner className="text-primary" /> : <SparklesIcon className="text-primary" />}
          {running ? `${run.done}/${run.total}` : "Analyze"}
        </Button>
      </DialogTrigger>
      <DialogContent className={DIALOG_CLASS}>
        <DialogHeader className="px-6 pt-6 pb-4 pr-14">
          <DialogTitle>AI Call Analysis — {name}</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto px-6 pb-4">
          {!run && (
            <EstimateStep
              id={`member-analysis-count-${member.id ?? name}`}
              name={name}
              countInput={countInput}
              setCountInput={setCountInput}
              estimating={estimating}
              estimate={estimate}
              count={count}
            />
          )}
          {running && <RunningStep run={run} name={name} />}
          {run?.status === "error" && (
            <div className="flex items-start gap-3 rounded-surface bg-danger-soft px-4 py-3">
              <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-danger-ink" aria-hidden="true" />
              <p className="text-sm text-danger-ink">{run.error}</p>
            </div>
          )}
          {run?.status === "done" && <ResultsStep run={run} analyzed={analyzed} outcomes={outcomes} />}
        </div>

        <DialogFooter className="px-6 pt-2 pb-6">
          {!run && (
            <>
              <DialogClose asChild>
                <Button>Cancel</Button>
              </DialogClose>
              <Button
                variant="primary"
                onClick={() => startMemberAnalysis(name, toAnalyze)}
                disabled={estimating || !estimate || estimate.calls_found === 0}
              >
                <SparklesIcon />
                Analyze {toAnalyze} {toAnalyze === 1 ? "call" : "calls"}
              </Button>
            </>
          )}
          {running && (
            <DialogClose asChild>
              <Button>
                <BellIcon />
                Run in background
              </Button>
            </DialogClose>
          )}
          {run?.status === "error" && (
            <>
              <DialogClose asChild>
                <Button>Close</Button>
              </DialogClose>
              <Button variant="primary" onClick={() => resetMemberRun(name)}>
                Try again
              </Button>
            </>
          )}
          {run?.status === "done" && (
            <>
              <Button onClick={() => resetMemberRun(name)}>
                <SparklesIcon className="text-primary" />
                New analysis
              </Button>
              <DialogClose asChild>
                <Button variant="primary">Close</Button>
              </DialogClose>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
