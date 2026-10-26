"use client"

import * as React from "react"
import { useSWRConfig } from "swr"
import { Check, History } from "lucide-react"

import BirdyAvatar from "@/components/birdy/BirdyAvatar"
import { Badge, Button, Frame, Notice, toast } from "@/components/ds"
import { acceptProposal, rejectProposal, revalidateAgentLearning, useAgentProposals } from "@/lib/agents-api"
import { cn } from "@/lib/utils"
import { DENY_REASONS } from "./DenyReason"
import { RULE_COPY } from "./PlaybookRule"

// What a rule's actions are called in a sentence ("3 revives").
const NOUNS = {
  pause_over_target: ["pause", "pauses"],
  revive_winner: ["revive", "revives"],
  flag_no_spend: ["flag", "flags"],
  flag_declining: ["flag", "flags"],
}
const noun = (kind, n) => (NOUNS[kind] ?? ["action", "actions"])[n === 1 ? 0 : 1]

const reasonLabel = (code) => DENY_REASONS.find((r) => r.code === code)?.label ?? code

/** The param's slot in the rule's sentence: its label, money flag and suffix. */
function slotOf(kind, key) {
  return (RULE_COPY[kind]?.parts ?? []).find((p) => typeof p === "object" && p.key === key) ?? { label: key }
}

/** "90 days", "£60", "1.5×". */
export function formatParam(kind, key, value, currency = "$") {
  const { money, suffix } = slotOf(kind, key)
  const v = value == null ? "–" : String(value)
  if (money) return `${currency}${v}`
  if (!suffix) return v
  return suffix === "×" || suffix === "%" ? `${v}${suffix}` : `${v} ${suffix}`
}

function DiffRow({ label, kind, values, currency, tone }) {
  const Mark = tone === "before" ? "del" : "ins"
  return (
    <>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-secondary">
        {Object.entries(values).map(([key, value]) => (
          <span key={key} className="inline-flex items-center gap-1.5">
            <span>{slotOf(kind, key).label}</span>
            <Mark
              className={cn(
                "rounded-sm px-1.5 py-px font-mono no-underline",
                tone === "before" ? "bg-danger-soft text-danger-ink line-through" : "bg-success-soft text-success-ink"
              )}
            >
              {formatParam(kind, key, value, currency)}
            </Mark>
          </span>
        ))}
      </span>
    </>
  )
}

function evidenceSentence(p) {
  const count = p.evidence?.count ?? p.evidence?.item_ids?.length ?? 0
  const who = p.kind === "client_override" && p.client_name ? ` for ${p.client_name}` : ""
  return (
    <>
      In the last 14 days you denied {count} {noun(p.rule_kind, count)}
      {who} with <b className="font-medium text-foreground">“{reasonLabel(p.reason_code)}”</b>.
    </>
  )
}

function replaySentence(p) {
  const r = p.replay_effect
  if (!r || typeof r.of !== "number") return null
  if (!r.removed) return `On the last 30 days this would not change any of ${r.of} ${noun(p.rule_kind, r.of)}.`
  const denied = r.removed_were_denied ?? 0
  const tail =
    denied === 0
      ? ""
      : denied === r.removed
        ? r.removed === 1
          ? ", and it was one you denied"
          : `, and all ${denied} were ones you denied`
        : `, and ${denied} of them ${denied === 1 ? "was one" : "were ones"} you denied`
  return `On the last 30 days this removes ${r.removed} of ${r.of} ${noun(p.rule_kind, r.of)}${tail}.`
}

/**
 * One suggested rule change: the evidence, Before (struck through) and After, what it would have
 * changed over the last 30 days, then Keep (reject) or Update rule (accept). Once accepted it
 * shows "Rule updated" in place.
 *
 * @param {object} props
 * @param {string} props.agentId
 * @param {object} props.proposal A Task 17 proposal
 * @param {string} [props.currency="$"]
 * @param {(proposal: object, decision: "accepted"|"rejected", response: object) => void} [props.onDecided]
 */
export function ProposalDiff({ agentId, proposal: p, currency = "$", onDecided, className }) {
  const [busy, setBusy] = React.useState(null)
  const [accepted, setAccepted] = React.useState(p.status === "accepted")
  const override = p.kind === "client_override"
  const keys = Object.keys(p.before ?? {})
  const keepLabel = keys.length === 1 ? `Keep ${formatParam(p.rule_kind, keys[0], p.before[keys[0]], currency)}` : "Keep as is"
  const count = p.evidence?.count ?? p.evidence?.item_ids?.length ?? 0
  const ruleTitle = RULE_COPY[p.rule_kind]?.title ?? p.rule_label

  const decide = async (decision) => {
    setBusy(decision)
    try {
      const res = decision === "accepted" ? await acceptProposal(agentId, p.id) : await rejectProposal(agentId, p.id)
      if (decision === "accepted") setAccepted(true)
      onDecided?.(p, decision, res)
    } catch (err) {
      toast.error(decision === "accepted" ? "Couldn't update the rule" : "Couldn't keep the rule", {
        description: err.message,
      })
    } finally {
      setBusy(null)
    }
  }

  const replay = replaySentence(p)

  return (
    <Frame
      title={override ? "Client exception" : "Suggested rule change"}
      leading={<BirdyAvatar size={24} />}
      action={
        <Badge tone="primary" size="sm">
          From {count} {count === 1 ? "denial" : "denials"}
        </Badge>
      }
      padded
      className={cn("min-w-0", className)}
    >
      {accepted ? (
        <Notice tone="success" icon={Check} title="Rule updated">
          {ruleTitle}
          {override && p.client_name ? ` for ${p.client_name}` : ""} now uses{" "}
          {Object.entries(p.after ?? {})
            .map(([k, v]) => `${slotOf(p.rule_kind, k).label.toLowerCase()} ${formatParam(p.rule_kind, k, v, currency)}`)
            .join(", ")}
          . Logged in Activity.
        </Notice>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-base leading-relaxed text-ink-secondary">{evidenceSentence(p)}</p>
          <div className="rounded-control border border-border px-4 py-3">
            <p className="mb-2 text-xs text-muted-foreground">
              {ruleTitle}
              {override && p.client_name ? ` · ${p.client_name}` : ""}
            </p>
            <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2">
              <DiffRow label="Before" kind={p.rule_kind} values={p.before ?? {}} currency={currency} tone="before" />
              <DiffRow label="After" kind={p.rule_kind} values={p.after ?? {}} currency={currency} tone="after" />
            </div>
          </div>
          {replay && (
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <History aria-hidden className="mt-0.5 size-4 shrink-0" />
              {replay}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={() => decide("rejected")} disabled={busy != null} loading={busy === "rejected"}>
              {keepLabel}
            </Button>
            <Button
              variant="primary"
              onClick={() => decide("accepted")}
              disabled={busy != null}
              loading={busy === "accepted"}
            >
              <Check aria-hidden />
              {override ? "Add exception" : "Update rule"}
            </Button>
          </div>
        </div>
      )}
    </Frame>
  )
}

/**
 * The agent's open proposals, each as a `ProposalDiff`. An accepted one stays on screen as
 * "Rule updated" until the page is left; a kept one goes. Renders nothing when empty unless
 * `empty` is given.
 *
 * @param {object} props
 * @param {string} props.agentId
 * @param {string} [props.currency]
 * @param {React.ReactNode} [props.title] A heading over the list
 * @param {React.ReactNode} [props.empty] Shown (under the title) when there is nothing to suggest
 */
export function ProposalList({ agentId, currency, title, empty, className }) {
  const { proposals, mutate } = useAgentProposals(agentId)
  const { mutate: mutateCache } = useSWRConfig()
  const [settled, setSettled] = React.useState(() => new Map())

  const onDecided = React.useCallback(
    (proposal, decision) => {
      if (decision === "accepted") {
        setSettled((prev) => new Map(prev).set(proposal.id, { ...proposal, status: "accepted" }))
        toast.success("Rule updated", { description: RULE_COPY[proposal.rule_kind]?.title ?? proposal.rule_label })
      } else {
        toast("Kept. Birdy won't suggest this again unless the pattern changes.")
      }
      mutate((cur) => (Array.isArray(cur) ? cur.filter((x) => x.id !== proposal.id) : cur), { revalidate: false })
      revalidateAgentLearning(mutateCache, agentId)
    },
    [agentId, mutate, mutateCache]
  )

  const list = [...proposals.filter((x) => !settled.has(x.id)), ...settled.values()]
  if (list.length === 0 && !empty) return null

  return (
    <section className={cn("flex min-w-0 flex-col gap-3", className)}>
      {title && <h2 className="text-lg font-medium text-foreground">{title}</h2>}
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        list.map((p) => (
          <ProposalDiff key={p.id} agentId={agentId} proposal={p} currency={currency} onDecided={onDecided} />
        ))
      )}
    </section>
  )
}
