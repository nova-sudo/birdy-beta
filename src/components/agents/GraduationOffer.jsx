"use client"

import * as React from "react"
import { useSWRConfig } from "swr"
import { ShieldAlert, Zap } from "lucide-react"

import BirdyAvatar from "@/components/birdy/BirdyAvatar"
import { Badge, Button, Frame, Notice, toast } from "@/components/ds"
import { graduateRule, revalidateAgentLearning, useAgentOffers } from "@/lib/agents-api"
import { queryKeys } from "@/lib/query-keys"
import { cn } from "@/lib/utils"
import { RULE_COPY } from "./PlaybookRule"

export const CHOICE_LABELS = {
  auto_notify: "Auto-run, tell me after",
  auto_silent: "Auto-run silently",
  keep_asking: "Keep asking",
}

const titleOf = (offer) => RULE_COPY[offer.rule_kind]?.title ?? offer.rule_label ?? "this rule"

/**
 * Offers a rule auto-run after a streak of approvals: "Auto-run, tell me after" (primary),
 * "Auto-run silently" and "Keep asking". Once answered it shows the choice in place.
 *
 * @param {object} props
 * @param {object} props.offer A graduation offer: `{rule_id, rule_kind, rule_label, streak}`
 * @param {(choice: string) => Promise<void>} props.onChoose
 * @param {string|null} [props.chosen] The answer, once given
 */
export function GraduationOffer({ offer, onChoose, chosen = null, className }) {
  const [busy, setBusy] = React.useState(null)
  const choose = async (choice) => {
    setBusy(choice)
    try {
      await onChoose(choice)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Frame title="Ready to hand this one over?" className={cn("min-w-0", className)}>
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-5">
        <BirdyAvatar size={48} />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-medium text-foreground">
            You've approved the last {offer.streak ?? 10} “{titleOf(offer)}” actions
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Want me to handle these myself? You'll see each one in Activity and can undo for 24 hrs.
          </p>
        </div>
        {chosen ? (
          <Badge tone={chosen === "keep_asking" ? "info" : "primary"} icon={chosen === "keep_asking" ? undefined : Zap}>
            {CHOICE_LABELS[chosen]}
          </Badge>
        ) : (
          <div className="flex flex-col gap-2 sm:min-w-[250px]">
            <Button
              variant="primary"
              size="lg"
              onClick={() => choose("auto_notify")}
              disabled={busy != null}
              loading={busy === "auto_notify"}
            >
              <Zap aria-hidden />
              {CHOICE_LABELS.auto_notify}
            </Button>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => choose("auto_silent")}
                disabled={busy != null}
                loading={busy === "auto_silent"}
              >
                {CHOICE_LABELS.auto_silent}
              </Button>
              <Button
                className="flex-1"
                onClick={() => choose("keep_asking")}
                disabled={busy != null}
                loading={busy === "keep_asking"}
              >
                {CHOICE_LABELS.keep_asking}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Frame>
  )
}

/**
 * Says Birdy moved a rule back to Ask me after 2 undos of its auto-run actions in 7 days. Its one
 * answer is "Keep asking", which is all the backend takes for a brake notice.
 *
 * @param {object} props
 * @param {object} props.offer A brake notice: `{rule_kind, rule_label, undos}`
 * @param {() => Promise<void>} props.onAcknowledge
 */
export function BrakeNotice({ offer, onAcknowledge, className }) {
  const [busy, setBusy] = React.useState(false)
  const undos = offer.undos ?? 2
  return (
    <Notice
      tone="warning"
      icon={ShieldAlert}
      title={`${titleOf(offer)} is back on Ask me`}
      className={className}
      action={
        <Button
          size="sm"
          loading={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await onAcknowledge()
            } finally {
              setBusy(false)
            }
          }}
        >
          {CHOICE_LABELS.keep_asking}
        </Button>
      }
    >
      You undid {undos} of its auto-run actions within 7 days, so Birdy moved it back to Ask me. It can earn auto-run
      again after 10 approvals in a row.
    </Notice>
  )
}

/**
 * The agent's pending offers: graduation offers, then brake notices. Answering one writes the
 * returned rule into the rules cache at once (so mode badges update), then re-reads rules,
 * offers, proposals and the work list. Renders nothing when there is nothing pending.
 *
 * @param {object} props
 * @param {string} props.agentId
 */
export function LearningOffers({ agentId, className }) {
  const { offers, mutate } = useAgentOffers(agentId)
  const { mutate: mutateCache } = useSWRConfig()
  // offer id → {offer, choice}: graduation offers answered this visit stay, showing the answer.
  const [answered, setAnswered] = React.useState(() => new Map())

  const answer = React.useCallback(
    async (offer, choice) => {
      let rule
      try {
        rule = await graduateRule(agentId, offer.rule_id, choice)
      } catch (err) {
        toast.error("Couldn't save that", { description: err.message })
        return
      }
      if (rule?.id) {
        mutateCache(
          queryKeys.agentRules(agentId),
          (list) => (Array.isArray(list) ? list.map((r) => (r.id === rule.id ? rule : r)) : list),
          { revalidate: false }
        )
      }
      if (offer.type === "graduation") {
        setAnswered((prev) => new Map(prev).set(offer.id, { offer, choice }))
      }
      const title = titleOf(offer)
      toast(
        choice === "keep_asking"
          ? offer.type === "brake"
            ? `Okay, Birdy will keep asking about ${title}.`
            : "Okay, I'll keep asking. I'll check again after 10 more."
          : `${title} is now on auto-run.`
      )
      mutate((cur) => (Array.isArray(cur) ? cur.filter((o) => o.id !== offer.id) : cur), { revalidate: false })
      revalidateAgentLearning(mutateCache, agentId)
    },
    [agentId, mutate, mutateCache]
  )

  const pending = offers.filter((o) => !answered.has(o.id))
  const grads = [
    ...pending.filter((o) => o.type === "graduation").map((offer) => ({ offer, choice: null })),
    ...answered.values(),
  ]
  const brakes = pending.filter((o) => o.type === "brake")
  if (grads.length === 0 && brakes.length === 0) return null

  return (
    <div className={cn("flex min-w-0 flex-col gap-3", className)}>
      {brakes.map((offer) => (
        <BrakeNotice key={offer.id} offer={offer} onAcknowledge={() => answer(offer, "keep_asking")} />
      ))}
      {grads.map(({ offer, choice }) => (
        <GraduationOffer
          key={offer.id}
          offer={offer}
          chosen={choice}
          onChoose={(c) => answer(offer, c)}
        />
      ))}
    </div>
  )
}
