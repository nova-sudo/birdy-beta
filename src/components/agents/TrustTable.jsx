"use client"

import * as React from "react"
import { ShieldCheck, Zap } from "lucide-react"

import { Badge, ErrorState, Frame, Skeleton } from "@/components/ds"
import { useAgentRules } from "@/lib/agents-api"
import { cn } from "@/lib/utils"
import { RULE_ORDER } from "./PlaybookDraft"
import { RULE_COPY } from "./PlaybookRule"

const SLOTS = 10

// One square per decision: approved, denied, undone; an empty slot is "none".
const DECISIONS = {
  ok: { fill: "bg-success", word: "approved" },
  no: { fill: "bg-danger", word: "denied" },
  undo: { fill: "bg-warning", word: "undone" },
  none: { fill: "bg-muted", word: null },
}

const MODES = {
  flag: { tone: "neutral", label: "Flag only" },
  ask: { tone: "info", label: "Ask me" },
  auto: { tone: "primary", label: "Auto-run", icon: Zap },
}

export function ModeBadge({ mode }) {
  const m = MODES[mode] ?? MODES.ask
  return (
    <Badge tone={m.tone} size="sm" icon={m.icon}>
      {m.label}
    </Badge>
  )
}

/** The last 10 decisions as squares, oldest first, padded with empty slots. */
export function TrustSquares({ last10 }) {
  const list = (Array.isArray(last10) ? last10 : []).slice(-SLOTS)
  const slots = [...list, ...Array(SLOTS - list.length).fill("none")]
  const said = list.map((d) => DECISIONS[d]?.word ?? d).join(", ")
  return (
    <span
      role="img"
      aria-label={list.length ? `Last ${list.length} decisions: ${said}` : "No decisions yet"}
      className="inline-flex gap-1"
    >
      {slots.map((d, i) => (
        <span
          key={i}
          aria-hidden
          data-decision={DECISIONS[d] ? d : "none"}
          className={cn("size-3 rounded-[3px]", (DECISIONS[d] ?? DECISIONS.none).fill)}
        />
      ))}
    </span>
  )
}

/**
 * Trust by rule: each rule's mode, its last 10 decisions as squares (approved in success, denied
 * in danger, undone in warning) and how many of those were approvals.
 *
 * @param {object} props
 * @param {string} props.agentId
 */
export function TrustTable({ agentId, className }) {
  const { rules, error, isLoading, mutate } = useAgentRules(agentId)
  const ordered = React.useMemo(
    () =>
      [...rules]
        .filter((r) => RULE_COPY[r.kind])
        .sort((a, b) => RULE_ORDER.indexOf(a.kind) - RULE_ORDER.indexOf(b.kind)),
    [rules]
  )

  return (
    <Frame
      title="Trust by rule"
      description="Last 10 decisions per rule"
      descriptionInline
      leading={<ShieldCheck aria-hidden className="size-4 text-primary" />}
      className={cn("min-w-0", className)}
    >
      {error ? (
        <ErrorState className="p-4" title="Couldn't load the rules" onRetry={() => mutate()} />
      ) : isLoading ? (
        <Skeleton className="m-4 h-40 rounded-control" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-divider text-left text-xs text-muted-foreground">
                <th scope="col" className="px-4 py-2.5 font-medium">Rule</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Mode</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Recent decisions</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Approved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {ordered.map((rule) => {
                const copy = RULE_COPY[rule.kind]
                const Icon = copy.icon
                const last10 = (rule.stats?.last10 ?? []).slice(-SLOTS)
                const ok = last10.filter((d) => d === "ok").length
                return (
                  <tr key={rule.id} data-kind={rule.kind}>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2 text-foreground">
                        <span
                          aria-hidden
                          className={cn("flex size-6 shrink-0 items-center justify-center rounded-full", copy.chip)}
                        >
                          <Icon className="size-3.5" strokeWidth={2.5} />
                        </span>
                        {copy.title}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ModeBadge mode={rule.mode} />
                    </td>
                    <td className="px-4 py-3">
                      <TrustSquares last10={last10} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-foreground">
                      {last10.length ? `${ok} / ${last10.length}` : <span className="text-muted-foreground">–</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="border-t border-divider px-4 py-3 text-sm text-muted-foreground">
            <b className="font-medium text-foreground">Built-in brake:</b> if you undo 2 auto-run actions from the same
            rule in a week, that rule drops back to Ask me and Birdy tells you why.
          </p>
        </div>
      )}
    </Frame>
  )
}
