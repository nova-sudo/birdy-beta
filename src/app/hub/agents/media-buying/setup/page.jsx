"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, ArrowRight, BookOpen, Lock, Zap } from "lucide-react"

import {
  Button,
  ErrorState,
  Frame,
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
import { DryRunSummary } from "@/components/agents/DryRunSummary"
import { GuardrailsForm } from "@/components/agents/GuardrailsForm"
import { PlaybookRule } from "@/components/agents/PlaybookRule"
import { WizardSteps } from "@/components/agents/WizardSteps"
import {
  activateAgent,
  createAgent,
  patchAgent,
  patchRule,
  useAgent,
  useAgentRules,
  useAgents,
} from "@/lib/agents-api"
import { currencySymbol } from "@/lib/chat-viz"
import { DEFAULT_DATE_PRESET } from "@/lib/constants"
import { useClientGroups } from "@/lib/useClientGroups"

const SETUP_PATH = "/hub/agents/media-buying/setup"
const AGENT_PATH = "/hub/agents/media-buying"
const RULE_ORDER = ["pause_over_target", "revive_winner", "flag_no_spend", "flag_declining"]

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
    title: "Teach it your strategy",
    description: "Birdy asks how you run your accounts and tests its rules on real past cases.",
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
    const missing = err.detail?.missing
    if (Array.isArray(missing) && missing.length) return `It isn't ready to turn on yet. Still needed: ${missing.join(", ")}.`
    return typeof err.detail === "string" ? err.detail : "It isn't ready to turn on yet."
  }
  if (err?.status === 400) return typeof err.detail === "string" ? err.detail : "Check the setup and try again."
  return "Couldn't turn it on. Try again in a moment."
}

/** Finds this user's agent, creating it once when there is none. */
function useEnsuredAgent() {
  const { agents, isLoading, mutate } = useAgents()
  const existing = agents.find((a) => a.type === "media_buying") ?? agents[0] ?? null
  const [created, setCreated] = useState(null)
  const [error, setError] = useState(null)
  const creating = useRef(false)

  useEffect(() => {
    if (isLoading || existing || creating.current) return
    // A ref survives strict mode's second effect run, so this posts once.
    creating.current = true
    createAgent()
      .then((agent) => {
        setCreated(agent)
        mutate()
      })
      .catch((err) => {
        // 409: it exists after all (another tab); the refetch finds it.
        if (err?.status === 409) mutate()
        else setError(err?.message || "Couldn't create the agent")
      })
  }, [isLoading, existing, mutate])

  return { agentId: existing?.id ?? created?.id ?? null, error }
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

  const selectedRef = useRef(selected)
  selectedRef.current = selected
  const savedScope = useRef(stored)
  savedScope.current = stored

  // A target can only be set on a client in the saved scope: save the current ticks first.
  const ensureScope = useCallback(
    async (gid) => {
      if (savedScope.current.includes(gid)) return
      const ids = Array.from(new Set([...selectedRef.current, gid]))
      const updated = await patchAgent(agent.id, { scope: { client_group_ids: ids } })
      mutateAgent(updated, { revalidate: false })
    },
    [agent.id, mutateAgent]
  )

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
              ensureScope={ensureScope}
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
                className="w-32 font-mono"
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

function TrainStep({ onBack, onNext }) {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Frame title="Training comes next" padded>
        <p className="text-base leading-relaxed text-ink-secondary">
          This is where Birdy will ask how you run your accounts and practise on real past cases until it&apos;s
          confident. That step is on its way. For now, go on to the dry run to see what your playbook would have done.
        </p>
      </Frame>
      <div className="flex items-center justify-end gap-2 max-sm:flex-col-reverse max-sm:items-stretch">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft aria-hidden />
          Back
        </Button>
        <Button variant="primary" size="lg" onClick={onNext}>
          Next: check the dry run
          <ArrowRight aria-hidden />
        </Button>
      </div>
    </div>
  )
}

function CheckStep({ agent, clients, onBack, onActivated }) {
  const { rules, isLoading, error: rulesError, mutate: mutateRules } = useAgentRules(agent.id)
  const [runKey, setRunKey] = useState(0)
  const [result, setResult] = useState(null)
  const [ruleError, setRuleError] = useState(null)
  const [activating, setActivating] = useState(false)
  const [activateError, setActivateError] = useState(null)

  const currency = scopeCurrency(clients, agent.scope?.client_group_ids ?? [])
  const ordered = useMemo(
    () => [...rules].sort((a, b) => RULE_ORDER.indexOf(a.kind) - RULE_ORDER.indexOf(b.kind)),
    [rules]
  )

  const changeRule = async (rule, patch) => {
    setRuleError(null)
    const merged = { ...rule, ...patch, params: { ...rule.params, ...(patch.params ?? {}) } }
    mutateRules(
      rules.map((r) => (r.id === rule.id ? merged : r)),
      { revalidate: false }
    )
    try {
      const saved = await patchRule(agent.id, rule.id, patch)
      mutateRules((list = []) => list.map((r) => (r.id === rule.id ? saved : r)), { revalidate: false })
      // Thresholds and on/off change what would have fired; the mode does not.
      if (patch.params || "enabled" in patch) setRunKey((k) => k + 1)
    } catch (err) {
      setRuleError(`Couldn't save that change: ${err.message}`)
      mutateRules()
    }
  }

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
      <Frame
        title="Playbook"
        leading={<BookOpen aria-hidden className="size-4 text-primary" />}
        className="min-w-0"
      >
        {rulesError ? (
          <ErrorState className="p-4" title="Couldn't load the playbook" onRetry={() => mutateRules()} />
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
                hits={result?.by_rule?.[rule.kind]}
                onChange={(patch) => changeRule(rule, patch)}
              />
            ))}
          </div>
        )}
      </Frame>

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

  const { agentId, error: createError } = useEnsuredAgent()
  const { agent, error: agentError, mutate: mutateAgent } = useAgent(agentId)
  const { clientGroups, loading: clientsLoading } = useClientGroups(DEFAULT_DATE_PRESET, { includeDaily: false })
  const clients = useMemo(() => clientGroups.map(toClient), [clientGroups])
  const { mutate: mutateAgents } = useAgents()

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
          onRetry={() => (createError ? window.location.reload() : mutateAgent())}
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
        <TrainStep onBack={() => go(1)} onNext={() => go(3)} />
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
