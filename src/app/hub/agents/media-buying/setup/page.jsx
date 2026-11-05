"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"

import { usePageHeader } from "@/components/page-header"
import { SalesHubHeaderTitle } from "@/components/hub/HubShell"
import { Button, EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ds"
import { StartOverButton } from "@/components/agents/StartOverButton"
import { WizardSteps } from "@/components/agents/WizardSteps"
import { ModesTable, modesOf, modesPatches } from "@/components/agents/stock/ModesTable"
import { SetupClients } from "@/components/agents/stock/SetupClients"
import { SetupCreative } from "@/components/agents/stock/SetupCreative"
import { SetupPreview } from "@/components/agents/stock/SetupPreview"
import { SetupSchedule } from "@/components/agents/stock/SetupSchedule"
import { ErrorNotice, STOCK_STEPS, SetupFooter, saveMessage, settingsOf } from "@/components/agents/stock/SetupShared"
import { SetupSlack } from "@/components/agents/stock/SetupSlack"
import { toClient } from "@/components/agents/AgentTraining"
import { useAgent } from "@/lib/agents-api"
import { DEFAULT_DATE_PRESET } from "@/lib/constants"
import { STOCK_AGENT_PATH, STOCK_SETUP_PATH, useStockActions, useStockAgent } from "@/lib/stock-agent-api"
import { useClientGroups } from "@/lib/useClientGroups"

const HEADINGS = {
  1: { title: "When should it check?", description: "Pick the time, the days each batch runs and whether you want a weekly message. You can change all of this later." },
  2: { title: "Clients and targets", description: "Choose who it watches and what a good cost per lead is for each. Every client needs zones." },
  3: { title: "Creative rules", description: "The limits behind removing, adding and reviving ads." },
  4: { title: "Slack", description: "Where cards and reports go. Optional: everything also works in Birdy." },
  5: { title: "Flag, Ask me or Auto", description: "Decide what Birdy may change in your live Meta ads by itself." },
  6: { title: "Preview your first report", description: "See what Birdy would do on your real data before you turn it on." },
}

const stepOf = (raw) => {
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 && n <= STOCK_STEPS.length ? n : 1
}

function ModesStep({ agent, clients, actions, onBack, onNext }) {
  const settings = useMemo(() => settingsOf(agent), [agent])
  const before = useMemo(() => modesOf(settings), [settings])
  const [next, setNext] = useState(before)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const watched = clients.filter((c) => (agent.scope?.client_group_ids ?? []).includes(c.id))

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      for (const settingsPatch of modesPatches(before, next)) await actions.patchSettings({ settings: settingsPatch })
      onNext()
    } catch (err) {
      setError(saveMessage(err))
      setSaving(false)
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <ModesTable settings={{ ...settings, add_writes_enabled: agent.add_writes_enabled === true, modes: next.modes, clients: Object.fromEntries(Object.entries(next.clientModes).map(([gid, modes]) => [gid, { modes }])) }} clients={watched} onChange={setNext} />
      <ErrorNotice>{error}</ErrorNotice>
      <SetupFooter onBack={onBack} onNext={save} saving={saving} />
    </div>
  )
}

function SetupWizard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const step = stepOf(searchParams?.get("step"))
  const go = useCallback((n) => router.push(`${STOCK_SETUP_PATH}?step=${n}`), [router])

  const { agent: listed, error: listError, isLoading: listLoading, mutate: mutateList } = useStockAgent()
  const { agent, error: agentError, mutate: mutateAgent } = useAgent(listed?.id)
  const actions = useStockActions(listed?.id)
  const { clientGroups, loading: clientsLoading, error: clientsError, refresh: refreshClients } = useClientGroups(DEFAULT_DATE_PRESET, { includeDaily: false })
  const clients = useMemo(() => clientGroups.map(toClient), [clientGroups])
  // The server takes only_flag as the whole list, so clients flagged earlier ride along on every save.
  const [flagOnly, setFlagOnly] = useState([])
  const [flagSeeded, setFlagSeeded] = useState(false)
  useEffect(() => {
    if (agent && !flagSeeded) {
      setFlagOnly(agent.scope?.flag_only_client_group_ids ?? [])
      setFlagSeeded(true)
    }
  }, [agent, flagSeeded])

  const topBar = useMemo(() => ({ title: <SalesHubHeaderTitle title="Birdy Media Buying Agent" subtitle="Set up" /> }), [])
  usePageHeader(topBar)

  const heading = HEADINGS[step]
  const failed = listError || agentError || clientsError
  const ready = agent && flagSeeded && !clientsLoading

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6 font-sans">
      <PageHeader
        backButton={{ label: "BirdyHub", href: "/hub" }}
        title={heading.title}
        description={heading.description}
        actions={
          agent && agent.status !== "active" && !agent.turned_off_at ? (
            <StartOverButton
              agent={agent}
              redirectTo="/hub"
              description="This deletes the clients you picked, your targets and every other choice made here. You can't undo it."
            />
          ) : undefined
        }
      />
      <WizardSteps current={step} steps={STOCK_STEPS} />

      {failed ? (
        <ErrorState
          title={clientsError && !listError && !agentError ? "Couldn't load your clients" : "Couldn't load your agent"}
          description={(agentError || listError)?.message || clientsError || "The request failed."}
          onRetry={() => (listError ? mutateList() : agentError ? mutateAgent() : refreshClients())}
        />
      ) : !listLoading && !listed ? (
        <EmptyState
          title="Set up the Birdy Media Buying Agent first"
          description="Start it from BirdyHub, then come back here."
          action={
            <Button asChild variant="primary">
              <Link href="/hub">Go to BirdyHub</Link>
            </Button>
          }
        />
      ) : !ready ? (
        <Skeleton className="h-96 w-full max-w-3xl rounded-frame" />
      ) : step === 1 ? (
        <SetupSchedule key={agent.id} agent={agent} actions={actions} onNext={() => go(2)} />
      ) : step === 2 ? (
        <SetupClients agent={agent} clients={clients} actions={actions} flagOnly={flagOnly} setFlagOnly={setFlagOnly} onBack={() => go(1)} onNext={() => go(3)} />
      ) : step === 3 ? (
        <SetupCreative agent={agent} actions={actions} onBack={() => go(2)} onNext={() => go(4)} />
      ) : step === 4 ? (
        <SetupSlack agent={agent} actions={actions} onBack={() => go(3)} onNext={() => go(5)} />
      ) : step === 5 ? (
        <ModesStep agent={agent} clients={clients} actions={actions} onBack={() => go(4)} onNext={() => go(6)} />
      ) : (
        <SetupPreview
          agent={agent}
          clients={clients}
          actions={actions}
          flagOnly={flagOnly}
          setFlagOnly={setFlagOnly}
          onBack={() => go(5)}
          onEditClients={() => go(2)}
          onActivated={async () => {
            await mutateAgent()
            router.push(STOCK_AGENT_PATH)
          }}
        />
      )}
    </div>
  )
}

export default function StockAgentSetupPage() {
  return (
    <Suspense fallback={null}>
      <SetupWizard />
    </Suspense>
  )
}
