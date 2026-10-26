"use client"

import { useState } from "react"
import { SparklesIcon } from "lucide-react"
import { toast } from "sonner"

import {
  Badge,
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetClose,
  SheetHeader,
  SheetTitle,
  Skeleton,
  Spinner,
} from "@/components/ds"
import { apiRequest } from "@/lib/api"
import { startJob, finishJob } from "@/lib/jobs-store"
import { AnalysisSection, BirdyRow, Stepper } from "./CallCentreParts"
import { formatDuration, outcomeTone, parseAnalysisSections } from "./analysis"

// ── Per-call AI analysis (Calls tab: sparkle button next to play/download) ──
// Rows here come from the HotProspector cache and carry no Mongo id, so the
// backend is addressed by recording_url (POST /api/call_logs/analyze matches
// it against call_logs, or analyzes ad-hoc if the cron hasn't synced it yet).
// The request registers in lib/jobs-store.js so the sidebar shows it, and the
// verdict is cached server-side — re-clicking an analyzed call is instant.
//
// The analysis opens in a right-side Sheet (bottom sheet below md). The backend
// is one request and reports no stage, so the sheet names only what it can
// observe: the request is in flight, then it is done.

const STEPS = [{ label: "Analysing call" }, { label: "Done" }]

function CallAnalysisBody({ status, result }) {
  if (status === "loading") {
    return (
      <div className="flex flex-col gap-4">
        <BirdyRow state="loading">
          <span className="text-sm font-medium text-muted-foreground">
            Analysing call…
          </span>
        </BirdyRow>
        <div className="flex flex-col gap-2 pl-9" aria-hidden="true">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <Stepper steps={STEPS} current={0} />
        <p className="text-sm text-muted-foreground">
          Feel free to close this panel. You&apos;ll be notified when it&apos;s ready.
        </p>
      </div>
    )
  }

  if (!result) return null
  const sections = parseAnalysisSections(result.analysis)
  return (
    <div className="flex flex-col gap-3">
      <BirdyRow>
        {sections.outcome && (
          <Badge tone={outcomeTone(sections.outcome)}>{sections.outcome.replace(/_/g, " ")}</Badge>
        )}
      </BirdyRow>
      {sections.happened ? (
        <>
          <AnalysisSection label="What happened" text={sections.happened} />
          <AnalysisSection label="What went wrong" text={sections.wrong} />
          <AnalysisSection label="Coaching" text={sections.coaching} />
        </>
      ) : (
        <div className="rounded-surface bg-muted px-4 py-3">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{result.analysis}</p>
        </div>
      )}
    </div>
  )
}

/**
 * The sparkle button on a call row, and the Sheet it opens. Without a
 * recording there is nothing to analyse, so it renders a dash.
 *
 * @param {object} props
 * @param {object} props.row A flattened call (see flattenCalls)
 */
export function CallAnalysisButton({ row }) {
  const [status, setStatus] = useState("idle") // idle | loading | done
  const [result, setResult] = useState(null)
  const [open, setOpen] = useState(false)

  if (!row.recording_url) return <span className="text-sm text-muted-foreground">—</span>

  const analyze = async () => {
    if (status === "loading") {
      setOpen(true)
      return
    }
    if (result) {
      setOpen(true)
      return
    }
    setStatus("loading")
    setOpen(true)
    const who = row.caller_name && row.caller_name !== "—" ? row.caller_name : row.to_number
    const jobId = startJob(`Analyzing call — ${who}`, {
      detail: "Analysing the recording.",
    })
    try {
      const res = await apiRequest("/api/call_logs/analyze", {
        method: "POST",
        body: JSON.stringify({
          recording_url: row.recording_url,
          agent_name: row.agent_name,
          lead_name: row.caller_name,
          direction: row.direction,
          duration_seconds: row.duration,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 402) throw new Error("Out of Birdy Credits — top up to run analyses.")
      if (!res.ok) throw new Error(data.detail || "Analysis failed.")
      finishJob(jobId)
      setResult(data)
      setStatus("done")
      toast.success("Call analysis ready", {
        description: data.cached ? "Loaded from a previous analysis (free)." : undefined,
        action: { label: "View", onClick: () => setOpen(true) },
      })
    } catch (e) {
      const msg = e?.message || "Analysis failed."
      finishJob(jobId, { status: "error", detail: msg })
      toast.error("Couldn't analyze this call", { description: msg })
      setStatus("idle")
      setOpen(false)
    }
  }

  return (
    <>
      <Button
        size="icon-sm"
        onClick={analyze}
        aria-label={result ? "View AI analysis" : "AI analyze this call"}
        title={result ? "View AI analysis" : "AI analyze this call"}
      >
        {status === "loading" ? <Spinner className="text-primary" /> : <SparklesIcon className={result ? "text-primary" : undefined} />}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="truncate">Call analysis — {row.caller_name || row.to_number}</SheetTitle>
            <SheetDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {row.agent_name && (
                <span>
                  Agent: <span className="font-medium text-foreground">{row.agent_name}</span>
                </span>
              )}
              <span className="num">{formatDuration(row.duration)}</span>
              {row.call_time && <span>{new Date(row.call_time).toLocaleString()}</span>}
            </SheetDescription>
          </SheetHeader>
          <CallAnalysisBody status={status} result={result} />
          <SheetFooter>
            <SheetClose asChild>
              <Button>Close</Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
