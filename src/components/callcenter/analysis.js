import { apiRequest } from "@/lib/api"
import { startJob, finishJob } from "@/lib/jobs-store"
import { toast } from "sonner"

// ── Shared call-analysis helpers ────────────────────────────────────────────

/** Seconds as "3m 20s". */
export const formatDuration = (seconds) => {
  const mins = Math.floor((seconds || 0) / 60)
  const secs = (seconds || 0) % 60
  return `${mins}m ${secs}s`
}

// Outcome → ds Badge tone.
export const OUTCOME_TONES = {
  connected: "success",
  appointment_set: "success",
  callback_promised: "info",
  voicemail: "warning",
  no_answer: "neutral",
  not_interested: "danger",
  wrong_number: "danger",
  other: "neutral",
}

export const outcomeTone = (outcome) => OUTCOME_TONES[outcome] || OUTCOME_TONES.other

export const parseOutcome = (summary) => {
  const m = /OUTCOME:\s*([a-z_]+)/i.exec(summary || "")
  return m ? m[1].toLowerCase() : null
}

export function parseAnalysisSections(text) {
  const grab = (label) => {
    const re = new RegExp(
      `${label}:\\s*([\\s\\S]*?)(?=\\n?\\s*(?:WHAT HAPPENED|WHAT WENT WRONG|COACHING|OUTCOME):|$)`,
      "i",
    )
    return re.exec(text || "")?.[1]?.trim() || null
  }
  return {
    happened: grab("WHAT HAPPENED"),
    wrong: grab("WHAT WENT WRONG"),
    coaching: grab("COACHING"),
    outcome: parseOutcome(text),
  }
}

// ── Member AI analysis run store ────────────────────────────────────────────
// Runs live in a module-level store so closing the dialog does NOT cancel the
// analysis — the user is told they'll be notified, and a sonner toast fires on
// completion whether or not the dialog is still open. Reopening the dialog
// re-attaches to the same run/result.
export const memberRuns = new Map() // member name -> { status, total, done, calls, failed, error }
const memberRunListeners = new Set()
const notifyMemberRuns = () => memberRunListeners.forEach((l) => l())

export const subscribeMemberRuns = (listener) => {
  memberRunListeners.add(listener)
  return () => memberRunListeners.delete(listener)
}

export const resetMemberRun = (name) => {
  memberRuns.delete(name)
  notifyMemberRuns()
}

export const MEMBER_ANALYSIS_MAX = 50
export const MEMBER_ANALYSIS_BATCH = 15 // mirrors the backend per-request cap

export async function startMemberAnalysis(name, total) {
  const run = { status: "running", total, done: 0, calls: [], failed: 0, error: null }
  memberRuns.set(name, run)
  notifyMemberRuns()
  // Sidebar "background tasks" indicator (lib/jobs-store.js).
  const jobId = startJob(`Analyzing ${name}'s calls`, {
    detail: `Up to ${total} recent calls — results land in the Members tab.`,
  })
  try {
    let before = null
    while (run.done < total) {
      const res = await apiRequest("/api/call-analysis/member/analyze", {
        method: "POST",
        body: JSON.stringify({
          agent_name: name,
          limit: Math.min(MEMBER_ANALYSIS_BATCH, total - run.done),
          before,
        }),
      })
      if (res.status === 402) throw new Error("Out of Birdy Credits — top up to run analyses.")
      if (!res.ok) throw new Error("Analysis request failed.")
      const data = await res.json()
      run.calls.push(...(data.calls || []))
      run.failed += data.counts?.failed || 0
      run.done += data.counts?.selected || 0
      before = data.next_before
      notifyMemberRuns()
      // Fewer recorded calls exist than requested — stop cleanly.
      if (!before || !(data.counts?.selected > 0) || data.counts?.remaining === 0) break
    }
    run.status = "done"
    finishJob(jobId)
    toast.success(`Call analysis for ${name} is ready`, {
      description: `${run.calls.filter((c) => c.summary).length} calls analyzed. Open their Analyze dialog in the Members tab to view.`,
    })
  } catch (e) {
    run.status = "error"
    run.error = e?.message || "Analysis failed."
    finishJob(jobId, { status: "error", detail: run.error })
    toast.error(`Call analysis for ${name} failed`, { description: run.error })
  }
  notifyMemberRuns()
}
