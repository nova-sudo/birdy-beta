"use client"

import * as React from "react"
import { BookOpen } from "lucide-react"

import { patchRule, useAgentRules } from "@/lib/agents-api"
import { ErrorState, Frame, Notice, Skeleton } from "@/components/ds"
import { PlaybookRule } from "@/components/agents/PlaybookRule"

export const RULE_ORDER = ["pause_over_target", "revive_winner", "flag_no_spend", "flag_declining"]

/**
 * The agent's rules as a live, editable list. It reads the shared rules key, so
 * revalidating that key (after a training-chat tool result) refreshes it in place.
 *
 * @param {object} props
 * @param {string} props.agentId
 * @param {string} [props.currency="$"]
 * @param {string} [props.title="Playbook draft"]
 * @param {React.ReactNode} [props.description]
 * @param {boolean} [props.showMode=true]
 * @param {Record<string, number>} [props.hitsByRule] Dry-run hits per rule kind
 * @param {(rule: object) => void} [props.onSaved] After an edit is saved
 */
export function PlaybookDraft({
  agentId,
  currency = "$",
  title = "Playbook draft",
  description,
  showMode = true,
  hitsByRule,
  onSaved,
  className,
}) {
  const { rules, isLoading, error, mutate } = useAgentRules(agentId)
  const [ruleError, setRuleError] = React.useState(null)

  const ordered = React.useMemo(
    () => [...rules].sort((a, b) => RULE_ORDER.indexOf(a.kind) - RULE_ORDER.indexOf(b.kind)),
    [rules]
  )

  const changeRule = async (rule, patch) => {
    setRuleError(null)
    const merged = { ...rule, ...patch, params: { ...rule.params, ...(patch.params ?? {}) } }
    mutate(
      rules.map((r) => (r.id === rule.id ? merged : r)),
      { revalidate: false }
    )
    try {
      const saved = await patchRule(agentId, rule.id, patch)
      mutate((list = []) => list.map((r) => (r.id === rule.id ? saved : r)), { revalidate: false })
      onSaved?.(saved)
    } catch (err) {
      setRuleError(`Couldn't save that change: ${err.message}`)
      mutate()
    }
  }

  return (
    <Frame
      title={title}
      description={description}
      descriptionInline
      leading={<BookOpen aria-hidden className="size-4 text-primary" />}
      className={className ?? "min-w-0"}
    >
      {error ? (
        <ErrorState className="p-4" title="Couldn't load the playbook" onRetry={() => mutate()} />
      ) : isLoading ? (
        <div className="flex flex-col gap-3 p-4">
          {RULE_ORDER.map((k) => (
            <Skeleton key={k} className="h-24 w-full rounded-control" />
          ))}
        </div>
      ) : (
        <div className="divide-y divide-divider">
          {ruleError && (
            <Notice tone="danger" className="m-3">
              {ruleError}
            </Notice>
          )}
          {ordered.map((rule) => (
            <PlaybookRule
              key={rule.id}
              rule={rule}
              currency={currency}
              showMode={showMode}
              hits={hitsByRule?.[rule.kind]}
              onChange={(patch) => changeRule(rule, patch)}
            />
          ))}
        </div>
      )}
    </Frame>
  )
}
