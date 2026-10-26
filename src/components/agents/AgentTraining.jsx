"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, RefreshCw, Target } from "lucide-react"

import BirdyAvatar from "@/components/birdy/BirdyAvatar"
import { Button, ErrorState, Frame, FrameAction, Notice, Skeleton } from "@/components/ds"
import { ConfidenceMeter } from "@/components/agents/ConfidenceMeter"
import { PlaybookDraft } from "@/components/agents/PlaybookDraft"
import { PracticeCase, followUpMessage } from "@/components/agents/PracticeCase"
import { TrainingChat } from "@/components/agents/TrainingChat"
import { fetchPractice, useAgentConfidence, useAgentRules } from "@/lib/agents-api"
import { currencySymbol } from "@/lib/chat-viz"

export const READY_SCORE = 80
const PRACTICE_BATCH = 3
const TARGET_MISSING = "Set a CPL target for "

/** A client group as the scope table wants it. */
export const toClient = (g) => ({
  id: g.id,
  name: g.name || "Untitled client",
  account: g.meta_ad_account_id || g.facebook?.ad_account_id || null,
  currency: g.facebook?.currency || g.ad_account_currency || null,
  cpl: g.targets?.cpl ?? null,
})

/** The most common account currency among the watched clients, as a symbol. */
export function scopeCurrency(clients, ids) {
  const counts = new Map()
  for (const c of clients) {
    if (!ids.includes(c.id) || !c.currency) continue
    counts.set(c.currency, (counts.get(c.currency) ?? 0) + 1)
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  return currencySymbol(top ?? clients.find((c) => c.currency)?.currency)
}

/** Whether the server says the agent can be switched on. */
export function isReady(confidence) {
  if (!confidence) return false
  if (typeof confidence.ready === "boolean") return confidence.ready
  return (confidence.score ?? 0) >= READY_SCORE && !(confidence.missing?.length > 0)
}

/** The line beside Next: how far off the bar it is, or that it is clear. */
function gateText(confidence) {
  if (!confidence) return "Checking Birdy's confidence…"
  if (isReady(confidence)) return "Ready. More practice keeps raising it."
  const score = Math.round(confidence.score ?? 0)
  if (score < READY_SCORE) return `${READY_SCORE - score} points to go. Answer practice cases or keep chatting.`
  return confidence.missing?.length ? `Still needed: ${confidence.missing.join(", ")}.` : "Not ready yet."
}

/**
 * Practice cases, served a few at a time. Kept in local state rather than SWR: a
 * revalidation would swap answered cases for new ones and hide their results.
 */
function usePracticeCases(agentId) {
  const [cases, setCases] = useState([])
  const [answered, setAnswered] = useState(() => new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const started = useRef(false)

  const load = useCallback(
    async (k) => {
      setLoading(true)
      setError(null)
      try {
        const batch = await fetchPractice(agentId, k)
        setCases((prev) => {
          const seen = new Set(prev.map((c) => c.case_id))
          return [...prev, ...(batch ?? []).filter((c) => !seen.has(c.case_id))]
        })
      } catch (err) {
        // Cases already on screen stay; the error shows beside them.
        setError(err?.message || "Couldn't load practice cases")
      } finally {
        setLoading(false)
      }
    },
    [agentId]
  )

  useEffect(() => {
    if (started.current) return
    started.current = true
    load(PRACTICE_BATCH)
  }, [load])

  // Unanswered cases are served first, so ask for them plus a fresh batch.
  const more = () => load(cases.filter((c) => !answered.has(c.case_id)).length + PRACTICE_BATCH)
  const markAnswered = (id) => setAnswered((prev) => new Set(prev).add(id))

  return { cases, loading, error, more, retry: () => load(PRACTICE_BATCH), markAnswered }
}

/**
 * Teach the agent: confidence meter, training chat, playbook draft and the practice round.
 * Step 2 of setup, and the agent page's Train tab. Back/Next show only when given.
 *
 * @param {object} props
 * @param {object} props.agent
 * @param {object[]} props.clients `toClient` shapes
 * @param {() => void} [props.onBack]
 * @param {() => void} [props.onNext] Enabled once confidence clears the bar
 */
export function AgentTraining({ agent, clients, onBack, onNext }) {
  const currency = scopeCurrency(clients, agent.scope?.client_group_ids ?? [])
  const { confidence, mutate: mutateConfidence } = useAgentConfidence(agent.id)
  const { mutate: mutateRules } = useAgentRules(agent.id)
  const practice = usePracticeCases(agent.id)
  const chatRef = useRef(null)

  const refreshConfidence = useCallback(() => mutateConfidence(), [mutateConfidence])
  // A training tool changed the playbook, a target or a topic: re-read both.
  const onChatChanged = useCallback(() => {
    mutateRules()
    mutateConfidence()
  }, [mutateRules, mutateConfidence])

  const watched = agent.scope?.client_group_ids?.length ?? 0
  const lacking = (confidence?.missing ?? []).filter((m) => m.startsWith(TARGET_MISSING)).length
  const targets = watched ? { set: Math.max(0, watched - lacking), total: watched } : undefined
  const ready = isReady(confidence)

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {confidence ? (
        <ConfidenceMeter
          score={confidence.score}
          parts={confidence.parts}
          threshold={READY_SCORE}
          targets={targets}
          missing={confidence.missing}
          ready={ready}
        />
      ) : (
        <Skeleton className="h-32 w-full rounded-frame" />
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1.25fr_1fr]">
        <Frame
          title="Training chat"
          leading={<BirdyAvatar size={24} />}
          className="min-w-0"
          contentClassName="h-[34rem]"
        >
          <TrainingChat ref={chatRef} agentId={agent.id} currency={currency} onChanged={onChatChanged} className="h-full" />
        </Frame>
        <PlaybookDraft
          agentId={agent.id}
          currency={currency}
          title="Playbook draft"
          description="Click any value to change it"
          showMode={false}
          onSaved={refreshConfidence}
        />
      </div>

      <Frame
        title="Practice round"
        description="Real cases from your last 60 days. Decide first, then see what Birdy would have done."
        leading={<Target aria-hidden className="size-4 text-primary" />}
        action={
          practice.cases.length > 0 && (
            <FrameAction icon={RefreshCw} disabled={practice.loading} onClick={practice.more}>
              {practice.loading ? "Loading…" : "More cases"}
            </FrameAction>
          )
        }
      >
        {practice.error && practice.cases.length > 0 && (
          <Notice
            tone="danger"
            className="m-3"
            action={
              <Button size="sm" variant="ghost" onClick={practice.more}>
                Try again
              </Button>
            }
          >
            Couldn&apos;t load more cases.
          </Notice>
        )}
        {practice.error && practice.cases.length === 0 ? (
          <ErrorState className="p-4" title="Couldn't load practice cases" onRetry={practice.retry} />
        ) : practice.cases.length === 0 ? (
          practice.loading ? (
            <div className="flex flex-col gap-3 p-4">
              {Array.from({ length: PRACTICE_BATCH }, (_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-control" />
              ))}
            </div>
          ) : (
            <p className="p-5 text-sm text-muted-foreground">
              No past cases to practise on in the last 60 days. Keep chatting to raise the score.
            </p>
          )
        ) : (
          <div className="divide-y divide-divider">
            {practice.cases.map((c) => (
              <PracticeCase
                key={c.case_id}
                agentId={agent.id}
                case={c}
                onAnswered={() => {
                  practice.markAnswered(c.case_id)
                  refreshConfidence()
                }}
                onResolved={refreshConfidence}
                onStale={() => {
                  practice.markAnswered(c.case_id)
                  refreshConfidence()
                }}
                onAskFollowUp={(pc, answer) =>
                  chatRef.current ? chatRef.current.send(followUpMessage(pc, answer)) : false
                }
              />
            ))}
          </div>
        )}
      </Frame>

      {(onBack || onNext) && (
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 max-sm:flex-col-reverse max-sm:items-stretch">
          <p className="text-sm text-muted-foreground max-sm:text-center" aria-live="polite">
            {gateText(confidence)}
          </p>
          <div className="flex items-center gap-2 max-sm:flex-col-reverse max-sm:items-stretch">
            {onBack && (
              <Button variant="ghost" onClick={onBack}>
                <ArrowLeft aria-hidden />
                Back
              </Button>
            )}
            {onNext && (
              <Button variant="primary" size="lg" disabled={!ready} onClick={onNext}>
                Next: check the dry run
                <ArrowRight aria-hidden />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
