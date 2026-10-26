"use client"

import { useState } from "react"
import { CircleAlert, Pause, RotateCcw, Sparkles, TrendingDown } from "lucide-react"

import { Badge, Button, CheckDiscIcon, CrossDiscIcon, MinusDiscIcon, Notice, toast } from "@/components/ds"
import { applyWorkItem, denyWorkItem, dismissWorkItem } from "@/lib/agents-api"
import { cn } from "@/lib/utils"
import { DenyReason } from "./DenyReason"

// Soft chip behind each item's icon, as in BirdyRead.
const CHIP = {
  danger: "bg-danger-soft text-danger-ink",
  warning: "bg-warning-soft text-warning-ink",
  success: "bg-success-soft text-success-ink",
  info: "bg-info-soft text-info-ink",
}

const KIND = {
  pause_over_target: { tone: "danger", Icon: Pause },
  revive_winner: { tone: "success", Icon: RotateCcw },
  flag_no_spend: { tone: "warning", Icon: CircleAlert },
  flag_declining: { tone: "warning", Icon: TrendingDown },
}

/** What a settled item says in place of its buttons. */
const DONE = {
  approved: { label: "Done in Meta", tone: "success", Icon: CheckDiscIcon },
  already: { label: "Already done in Meta", tone: "success", Icon: CheckDiscIcon },
  handled: { label: "Noted", tone: "success", Icon: CheckDiscIcon },
  denied: { label: "Denied", tone: "danger", Icon: CrossDiscIcon },
  dismissed: { label: "Dismissed", tone: "neutral", Icon: MinusDiscIcon },
}

/**
 * Whether an item only informs. A flag rule never writes to Meta, even when the
 * finding carries an action (the server blocks the apply), so those count too.
 */
export const isFlagItem = (item) => !item.has_action || item.rule_mode === "flag"

function Stats({ stats }) {
  if (!stats?.length) return null
  return (
    <p className="text-xs text-muted-foreground tabular-nums">
      {stats.map((s, i) => (
        <span key={`${s.label}-${i}`}>
          {i > 0 && <span aria-hidden> · </span>}
          {s.label} <span className={cn("font-medium", s.bad ? "text-danger-ink" : "text-foreground")}>{s.value}</span>
        </span>
      ))}
    </p>
  )
}

/**
 * One work item. Approve/Deny for an action, Got it (and Dismiss) for a flag.
 * Decisions show at once and roll back if the request fails.
 *
 * @param {object} props
 * @param {object} props.item A work item from `GET /api/agents/{id}/work`
 * @param {(item: object, decision: "approved"|"handled"|"denied"|"dismissed") => void} [props.onDecided] After the server took the decision
 * @param {"approved"|"handled"|"denied"|"dismissed"} [props.decided] Starts settled (the list keeps decided items on screen)
 */
export function WorkItem({ item, onDecided, decided = null, className }) {
  const [done, setDone] = useState(decided)
  const [busy, setBusy] = useState(null)
  const [denying, setDenying] = useState(false)
  const [applyFailed, setApplyFailed] = useState(null)
  const [error, setError] = useState(null)
  const [blockedNow, setBlockedNow] = useState(null)

  const { tone, Icon } = KIND[item.rule_kind] ?? { tone: "info", Icon: Sparkles }
  const flag = isFlagItem(item)
  const blocked = blockedNow ?? item.blocked_reason
  const settled = done ? DONE[done] : null

  const fail = (err, title) => {
    const message = err?.message || "Something went wrong"
    setError(message)
    toast.error(title, { description: message })
  }

  // Approve, or "Got it" on an item with nothing to write (marks it handled).
  const apply = async (kind) => {
    setBusy("apply")
    setError(null)
    setApplyFailed(null)
    setDone(kind)
    try {
      const r = await applyWorkItem(item.id)
      if (r && r.ok === false) {
        // A guardrail stopped it: it stays open and says why.
        setDone(null)
        const reason = r.blocked_reason ?? { code: "blocked", message: "Birdy couldn't do this right now." }
        setBlockedNow(reason)
        toast.warning("Not done", { description: reason.message })
        return
      }
      setBlockedNow(null)
      if (r?.outcome === "already_in_meta" && kind === "approved") setDone("already")
      const failed = r?.failed?.length ?? 0
      if (kind === "handled") toast.success("Noted", { description: item.title })
      else if (failed) toast.warning(`Done, but ${failed} ${failed === 1 ? "ad" : "ads"} failed in Meta`, { description: item.title })
      else toast.success("Done in Meta", { description: item.title })
      onDecided?.(item, kind)
    } catch (err) {
      setDone(null)
      if (kind === "approved") setApplyFailed(true)
      fail(err, kind === "approved" ? "Couldn't apply that in Meta" : "Couldn't save that")
    } finally {
      setBusy(null)
    }
  }

  // Dismiss, or "Got it" on a flag-mode item that carries an action.
  const dismiss = async (kind) => {
    setBusy("dismiss")
    setError(null)
    setDone(kind)
    try {
      await dismissWorkItem(item.id)
      toast(kind === "handled" ? "Noted" : "Dismissed", { description: item.title })
      onDecided?.(item, kind)
    } catch (err) {
      setDone(null)
      fail(err, "Couldn't dismiss that")
    } finally {
      setBusy(null)
    }
  }

  const deny = async (choice) => {
    setBusy("deny")
    setError(null)
    setDone("denied")
    setDenying(false)
    try {
      await denyWorkItem(item.id, choice)
      toast("Denied. Birdy will remember why.", { description: item.title })
      onDecided?.(item, "denied")
    } catch (err) {
      setDone(null)
      setDenying(true)
      fail(err, "Couldn't deny that")
    } finally {
      setBusy(null)
    }
  }

  const meta = [item.client, item.description].filter(Boolean).join(" · ")

  return (
    <div data-slot="work-item" data-done={done ? "" : undefined} className={cn(done && "bg-muted/40", className)}>
      <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span
            aria-hidden
            className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full", CHIP[tone])}
          >
            <Icon className="size-3.5" strokeWidth={2.5} />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className={cn("text-base font-medium", done ? "text-muted-foreground" : "text-foreground")}>{item.title}</p>
            {meta && <p className="text-sm text-muted-foreground">{meta}</p>}
            <Stats stats={item.stats} />
            {!done && blocked?.message && (
              <Notice tone="warning" className="mt-1.5">
                {blocked.message}
              </Notice>
            )}
            {!done && item.auto_failed && !blocked && (
              <Notice tone="warning" className="mt-1.5">
                Birdy tried this on auto-run and it didn&apos;t go through. Approve to try again.
              </Notice>
            )}
            {error && (
              <p role="alert" className="mt-1 text-xs text-danger-ink">
                {error}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 max-sm:pl-10">
          {settled ? (
            <Badge tone={settled.tone} size="sm" icon={settled.Icon}>
              {settled.label}
            </Badge>
          ) : flag ? (
            item.has_action ? (
              <Button size="sm" variant="primary" loading={busy === "dismiss"} onClick={() => dismiss("handled")}>
                Got it
              </Button>
            ) : (
              <>
                <Button size="sm" disabled={Boolean(busy)} onClick={() => dismiss("dismissed")}>
                  Dismiss
                </Button>
                <Button size="sm" variant="primary" loading={busy === "apply"} onClick={() => apply("handled")}>
                  Got it
                </Button>
              </>
            )
          ) : (
            <>
              <Button
                size="sm"
                disabled={Boolean(busy)}
                aria-expanded={denying}
                onClick={() => setDenying((v) => !v)}
              >
                Deny
              </Button>
              <Button size="sm" variant="primary" loading={busy === "apply"} onClick={() => apply("approved")}>
                {applyFailed ? "Retry" : "Approve"}
              </Button>
            </>
          )}
        </div>
      </div>

      {denying && !done && (
        <DenyReason
          className="border-t border-divider bg-muted/40 px-4 pt-3 pb-4 sm:pl-14"
          busy={busy === "deny"}
          onCancel={() => setDenying(false)}
          onConfirm={deny}
        />
      )}
    </div>
  )
}
