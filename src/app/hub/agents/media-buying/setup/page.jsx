"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, ArrowRight, Lock, RefreshCw, Target, Zap } from "lucide-react"

import { usePageHeader } from "@/components/page-header"
import BirdyAvatar from "@/components/birdy/BirdyAvatar"
import { SalesHubHeaderTitle } from "@/components/saleshub/SalesHubShell"

import {
  Button,
  ErrorState,
  Frame,
  FrameAction,
  Input,
  Label,
  Notice,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@/components/ds"
import { ClientScopeTable } from "@/components/agents/ClientScopeTable"
import { ConfidenceMeter } from "@/components/agents/ConfidenceMeter"
import { DryRunSummary } from "@/components/agents/DryRunSummary"
import { GuardrailsForm } from "@/components/agents/GuardrailsForm"
import { PlaybookDraft } from "@/components/agents/PlaybookDraft"
import { PracticeCase, followUpMessage } from "@/components/agents/PracticeCase"
import { TrainingChat } from "@/components/agents/TrainingChat"
import { WizardSteps } from "@/components/agents/WizardSteps"
import {
  activateAgent,
  createAgent,
  fetchPractice,
  patchAgent,
  useAgent,
  useAgentConfidence,
  useAgentRules,
  useAgents,
} from "@/lib/agents-api"
import { currencySymbol } from "@/lib/chat-viz"
import { DEFAULT_DATE_PRESET } from "@/lib/constants"
import { useClientGroups } from "@/lib/useClientGroups"

const SETUP_PATH = "/hub/agents/media-buying/setup"
const AGENT_PATH = "/hub/agents/media-buying"
const READY_SCORE = 80
const PRACTICE_BATCH = 3
const TARGET_MISSING = "Set a CPL target for "

const COMMON_TIMEZONES = [
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Amsterdam",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Sao_Paulo",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
  "UTC",
]

const HEADINGS = {
  1: {
    title: "Set up your Media Buying Agent",
    description: "Choose what it watches and what it's allowed to touch. You can change all of this later.",
  },
  2: {
    title: "Teach it how you buy",
    description:
      "Answer like you'd brief a new media buyer, then practise on real past cases. Birdy can't be switched on until its confidence clears the bar.",
  },
  3: {
    title: "Here's what it would have done",
    description:
      "Birdy ran your playbook over the last 30 days of real data. Nothing was changed. Use this to tune the rules before you switch it on.",
  },
}

const stepOf = (raw) => {
  const n = Number(raw)
  return n === 2 || n === 3 ? n : 1
}

/** A client group as the scope table wants it. */
const toClient = (g) => ({
  id: g.id,
  name: g.name || "Untitled client",
  account: g.meta_ad_account_id || g.facebook?.ad_account_id || null,
  currency: g.facebook?.currency || g.ad_account_currency || null,
  cpl: g.targets?.cpl ?? null,
})

/** The most common account currency among the watched clients, as a symbol. */
function scopeCurrency(clients, ids) {
  const counts = new Map()
  for (const c of clients) {
    if (!ids.includes(c.id) || !c.currency) continue
    counts.set(c.currency, (counts.get(c.currency) ?? 0) + 1)
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  return currencySymbol(top ?? clients.find((c) => c.currency)?.currency)
}

/** What Turn on says when the server refuses. */
function activationMessage(err) {
  if (err?.status === 404) return "Turning the agent on isn't available yet. Your setup is saved, so you can come back to it."
  if (err?.status === 409) {
    // The route sends {detail, missing}; older shapes nested missing in detail.
    const missing = err.missing ?? err.detail?.missing
    if (Array.isArray(missing) && missing.length) return `It isn't ready to turn on yet. Still needed: ${missing.join(", ")}.`
    return typeof err.detail === "string" ? err.detail : "It isn't ready to turn on yet."
  }
  if (err?.status === 400) return typeof err.detail === "string" ? err.detail : "Check the setup and try again."
  return "Couldn't turn it on. Try again in a moment."
}

const pickAgent = (list) => (list ?? []).find((a) => a.type === "media_buying") ?? list?.[0] ?? null

/**
 * Finds this user's agent, creating it once when there is none. Every way this can fail ends in
 * an error with a retry, never an endless skeleton.
 */
function useEnsuredAgent() {
  const { agents, error: listError, isLoading, mutate } = useAgents()
  const existing = pickAgent(agents)
  const [created, setCreated] = useState(null)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const creating = useRef(false)

  useEffect(() => {
    // A broken list is not an empty one: never create on the strength of an error.
    if (isLoading || listError || existing || creating.current) return
    // A ref survives strict mode's second effect run, so this posts once.
    creating.current = true
    createAgent()
      .then((agent) => {
        setCreated(agent)
        mutate()
      })
      .catch(async (err) => {
        if (err?.status !== 409) {
          setError(err?.message || "Couldn't create the agent")
          return
        }
        // 409: it exists after all (another tab). The refetch has to find it.
        try {
          if (!pickAgent(await mutate())) setError("Your agent exists but couldn't be loaded.")
        } catch (e) {
          setError(e?.message || "Couldn't load your agent")
        }
      })
  }, [isLoading, listError, existing, mutate, attempt])

  const retry = useCallback(() => {
    creating.current = false
    setError(null)
    setAttempt((n) => n + 1)
    mutate()
  }, [mutate])

  return {
    agentId: existing?.id ?? created?.id ?? null,
    error: error ?? (listError ? listError.message || "Couldn't load your agent" : null),
    retry,
  }
}

function ScopeStep({ agent, mutateAgent, clients, clientsLoading, onNext, onCancel }) {
  const stored = useMemo(() => agent.scope?.client_group_ids ?? [], [agent.scope])
  const [selected, setSelected] = useState(() =>
    stored.length ? stored : clients.filter((c) => c.account).map((c) => c.id)
  )
  const [schedule, setSchedule] = useState(() => ({
    time: agent.scope?.schedule?.time ?? "07:00",
    tz: agent.scope?.schedule?.tz ?? "UTC",
  }))
  const [permissions, setPermissions] = useState(() => agent.permissions ?? {})
  const [guardrails, setGuardrails] = useState(() => agent.guardrails ?? {})
  const [caps, setCaps] = useState(() => agent.client_caps ?? {})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // A new agent with no saved scope starts on every connected client, once they arrive.
  const seeded = useRef(stored.length > 0 || clients.length > 0)
  useEffect(() => {
    if (seeded.current || clientsLoading) return
    seeded.current = true
    setSelected(clients.filter((c) => c.account).map((c) => c.id))
  }, [clients, clientsLoading])

  const onCapChange = async (gid, cap) => {
    const next = { ...caps }
    if (cap == null) delete next[gid]
    else next[gid] = cap
    setCaps(next)
    try {
      const updated = await patchAgent(agent.id, { client_caps: next })
      mutateAgent(updated, { revalidate: false })
      setError(null)
    } catch (err) {
      setError(`Couldn't save that pause limit: ${err.message}`)
    }
  }

  const timezones = useMemo(
    () => (COMMON_TIMEZONES.includes(schedule.tz) ? COMMON_TIMEZONES : [schedule.tz, ...COMMON_TIMEZONES]),
    [schedule.tz]
  )

  const next = async () => {
    if (selected.length === 0) {
      setError("Pick at least one client for it to watch.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const updated = await patchAgent(agent.id, {
        scope: { client_group_ids: selected, schedule },
        permissions,
        guardrails,
      })
      mutateAgent(updated, { revalidate: false })
      onNext()
    } catch (err) {
      setError(`Couldn't save: ${err.message}`)
      setSaving(false)
    }
  }

  return (
    <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[1.4fr_1fr]">
      <div className="flex min-w-0 flex-col gap-7">
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-foreground">Which clients should it watch?</h2>
          {clientsLoading ? (
            <Skeleton className="h-64 w-full rounded-frame" />
          ) : (
            <ClientScopeTable
              agentId={agent.id}
              clients={clients}
              selected={selected}
              onSelectedChange={setSelected}
              caps={caps}
              onCapChange={onCapChange}
              globalCap={guardrails.max_pauses_per_client_day ?? 3}
            />
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-foreground">When should it check?</h2>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="agent-run-time" className="text-xs text-muted-foreground">
                Every day at
              </Label>
              <Input
                id="agent-run-time"
                type="time"
                size="md"
                value={schedule.time}
                onChange={(e) => e.target.value && setSchedule((s) => ({ ...s, time: e.target.value }))}
                className="w-44 font-mono"
              />
            </div>
            <div className="flex min-w-0 flex-1 basis-52 flex-col gap-1.5">
              <Label id="agent-tz-label" className="text-xs text-muted-foreground">
                Time zone
              </Label>
              <Select value={schedule.tz} onValueChange={(tz) => setSchedule((s) => ({ ...s, tz }))}>
                <SelectTrigger aria-labelledby="agent-tz-label" className="w-full max-w-72">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timezones.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Your work list is ready before the team starts.</p>
        </section>
      </div>

      <div className="flex min-w-0 flex-col gap-7">
        <GuardrailsForm
          permissions={permissions}
          guardrails={guardrails}
          onChange={(patch) => {
            if (patch.permissions) setPermissions((p) => ({ ...p, ...patch.permissions }))
            if (patch.guardrails) setGuardrails((g) => ({ ...g, ...patch.guardrails }))
          }}
        />
        <Notice tone="neutral" icon={Lock}>
          Every rule starts on <span className="font-medium">Ask me</span>. Nothing changes in your ad accounts until
          you approve it.
        </Notice>
        {error && <Notice tone="danger">{error}</Notice>}
        <div className="flex items-center justify-end gap-2 max-sm:flex-col-reverse max-sm:items-stretch">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" size="lg" loading={saving} onClick={next}>
            Next: teach it your strategy
            <ArrowRight aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Whether the server says the agent can be switched on. */
function isReady(confidence) {
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

function TrainStep({ agent, clients, onBack, onNext }) {
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

      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 max-sm:flex-col-reverse max-sm:items-stretch">
        <p className="text-sm text-muted-foreground max-sm:text-center" aria-live="polite">
          {gateText(confidence)}
        </p>
        <div className="flex items-center gap-2 max-sm:flex-col-reverse max-sm:items-stretch">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft aria-hidden />
            Back
          </Button>
          <Button variant="primary" size="lg" disabled={!ready} onClick={onNext}>
            Next: check the dry run
            <ArrowRight aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  )
}

function CheckStep({ agent, clients, onBack, onActivated }) {
  const [runKey, setRunKey] = useState(0)
  const [result, setResult] = useState(null)
  const [activating, setActivating] = useState(false)
  const [activateError, setActivateError] = useState(null)

  const currency = scopeCurrency(clients, agent.scope?.client_group_ids ?? [])

  const turnOn = async () => {
    setActivating(true)
    setActivateError(null)
    try {
      await activateAgent(agent.id)
      onActivated()
    } catch (err) {
      setActivateError(activationMessage(err))
      setActivating(false)
    }
  }

  return (
    <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-2">
      <PlaybookDraft
        agentId={agent.id}
        currency={currency}
        title="Playbook"
        hitsByRule={result?.by_rule}
        // Any saved edit gets a fresh run: the server only rejoins a job for identical rules.
        onSaved={() => setRunKey((k) => k + 1)}
      />

      <div className="flex min-w-0 flex-col gap-6">
        <DryRunSummary agentId={agent.id} currency={currency} runKey={runKey} onResult={setResult} />
        {activateError && <Notice tone="warning">{activateError}</Notice>}
        <div className="flex items-center justify-end gap-2 max-sm:flex-col-reverse max-sm:items-stretch">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft aria-hidden />
            Back
          </Button>
          <Button variant="primary" size="lg" loading={activating} onClick={turnOn}>
            <Zap aria-hidden />
            Turn on agent
          </Button>
        </div>
      </div>
    </div>
  )
}

function SetupWizard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const step = stepOf(searchParams?.get("step"))
  const go = useCallback((n) => router.push(`${SETUP_PATH}?step=${n}`), [router])

  const { agentId, error: createError, retry: retryCreate } = useEnsuredAgent()
  const { agent, error: agentError, mutate: mutateAgent } = useAgent(agentId)
  const { clientGroups, loading: clientsLoading } = useClientGroups(DEFAULT_DATE_PRESET, { includeDaily: false })
  const clients = useMemo(() => clientGroups.map(toClient), [clientGroups])
  const { mutate: mutateAgents } = useAgents()

  const topBar = useMemo(
    () => ({ title: <SalesHubHeaderTitle title="Media Buying Agent" subtitle="Set up" /> }),
    []
  )
  usePageHeader(topBar)

  const heading = HEADINGS[step]
  const failed = createError || agentError

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6 font-sans">
      <PageHeader
        backButton={{ label: "BirdyHub", href: "/hub" }}
        title={heading.title}
        description={heading.description}
      />
      <WizardSteps current={step} />

      {failed ? (
        <ErrorState
          title="Couldn't load your agent"
          description={createError || agentError?.message || "The request failed."}
          onRetry={() => (createError ? retryCreate() : mutateAgent())}
        />
      ) : !agent ? (
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.4fr_1fr]">
          <Skeleton className="h-96 w-full rounded-frame" />
          <Skeleton className="h-96 w-full rounded-frame" />
        </div>
      ) : step === 1 ? (
        <ScopeStep
          key={agent.id}
          agent={agent}
          mutateAgent={mutateAgent}
          clients={clients}
          clientsLoading={clientsLoading}
          onNext={() => go(2)}
          onCancel={() => router.push("/hub")}
        />
      ) : step === 2 ? (
        <TrainStep agent={agent} clients={clients} onBack={() => go(1)} onNext={() => go(3)} />
      ) : (
        <CheckStep
          agent={agent}
          clients={clients}
          onBack={() => go(2)}
          onActivated={() => {
            mutateAgents()
            router.push(AGENT_PATH)
          }}
        />
      )}
    </div>
  )
}

export default function MediaBuyingSetupPage() {
  return (
    <Suspense fallback={null}>
      <SetupWizard />
    </Suspense>
  )
}
