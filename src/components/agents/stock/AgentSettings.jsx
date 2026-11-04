"use client"

import { useEffect, useMemo, useState } from "react"

import { Badge, Button, confirm } from "@/components/ds"
import { ModesTable, modesOf, modesPatches } from "./ModesTable"
import { ErrorNotice, SetupFooter, clientErrors, saveMessage, settingsOf } from "./SetupShared"
import { SetupClients } from "./SetupClients"
import { SetupCreative } from "./SetupCreative"
import { SetupSchedule } from "./SetupSchedule"
import { SetupSlack } from "./SetupSlack"
import { SlackTemplates } from "./SlackTemplates"
import { TurnOn } from "./TurnOn"

const SAVE = "Save changes"

/** A titled settings section. Its form calls `onSaved` when it has saved, which shows "Saved." beside the title. */
function Section({ title, description, children }) {
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    if (!saved) return undefined
    const timer = setTimeout(() => setSaved(false), 5000)
    return () => clearTimeout(timer)
  }, [saved])
  return (
    <section aria-label={`${title} settings`} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {title}
          </h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {saved && (
          <p role="status" className="text-xs text-muted-foreground">
            Saved.
          </p>
        )}
      </div>
      {/* A form that found nothing to save says so with { changed: false }. */}
      {children((result) => result?.changed !== false && setSaved(true))}
    </section>
  )
}

/** Flag, Ask me or Auto for each change type, and per client. Saves the mode patches in order. */
function ModesSection({ agent, clients, actions, onSaved }) {
  const settings = useMemo(() => settingsOf(agent), [agent])
  const before = useMemo(() => modesOf(settings), [settings])
  const [next, setNext] = useState(before)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [rowErrors, setRowErrors] = useState({})
  const watched = clients.filter((c) => (agent.scope?.client_group_ids ?? []).includes(c.id))

  const save = async () => {
    setSaving(true)
    setError(null)
    setRowErrors({})
    try {
      for (const settingsPatch of modesPatches(before, next)) await actions.patchSettings({ settings: settingsPatch })
      onSaved()
    } catch (err) {
      setRowErrors(clientErrors(err))
      setError(saveMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <ModesTable
        settings={{
          ...settings,
          // Only the agent's own flag counts; a stale copy inside settings is ignored.
          add_writes_enabled: agent.add_writes_enabled === true,
          modes: next.modes,
          clients: Object.fromEntries(Object.entries(next.clientModes).map(([gid, modes]) => [gid, { modes }])),
        }}
        clients={watched}
        errors={rowErrors}
        onChange={setNext}
      />
      <ErrorNotice>{error}</ErrorNotice>
      <SetupFooter onNext={save} saving={saving} label={SAVE} />
    </div>
  )
}

/** Turning a live agent off, after asking. */
function TurnOff({ actions }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const press = async () => {
    const yes = await confirm({
      title: "Turn off this agent?",
      description:
        "Birdy stops checking your clients and posting reports, and your clients are released. Cards waiting for approval can't be applied until it is on again, though anything Birdy already did can still be undone. Your settings, lessons and past reports stay, and Turn on brings it back without a new preview.",
      confirmLabel: "Turn off agent",
    })
    if (!yes) return
    setBusy(true)
    setError(null)
    try {
      await actions.deactivateAgent()
    } catch (err) {
      setError(err?.message || "Couldn't turn the agent off. Try again.")
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" loading={busy} onClick={press}>
        Turn off
      </Button>
      {error && (
        <p role="alert" className="text-xs text-danger-ink">
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * The Settings tab: the same forms as setup, saved in place, the Flag / Ask me / Auto table and the Slack
 * templates. A change to clients can hit another agent's claim, and a refused save names the row it is about.
 *
 * @param {object} props
 * @param {object} props.agent The full agent (`settings`, `scope`, `add_writes_enabled`)
 * @param {object[]} props.clients `toClient` shapes for every client group
 * @param {ReturnType<import("@/lib/stock-agent-api").useStockActions>} props.actions
 */
export function AgentSettings({ agent, clients, actions }) {
  // The server takes only_flag as the whole list, so clients flagged earlier ride along on every save.
  const [flagOnly, setFlagOnly] = useState(() => agent.scope?.flag_only_client_group_ids ?? [])
  const live = agent.status === "active"
  const turnedOff = !live && Boolean(agent.turned_off_at)

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge tone={live ? "success" : "neutral"}>{live ? "Live" : turnedOff ? "Turned off" : "Not on yet"}</Badge>
          <span className="text-sm text-muted-foreground">
            {live
              ? "Changes here apply from the next check."
              : turnedOff
                ? "Birdy isn't checking your clients. Your settings are kept."
                : "Finish setup to turn it on."}
          </span>
        </div>
        {live && <TurnOff actions={actions} />}
        {turnedOff && <TurnOn agent={agent} clients={clients} />}
      </div>

      <Section title="Flag, Ask me or Auto" description="What Birdy does with each kind of change.">
        {(onSaved) => <ModesSection agent={agent} clients={clients} actions={actions} onSaved={onSaved} />}
      </Section>
      <Section title="Schedule" description="When the morning run starts and which days each batch runs.">
        {(onSaved) => <SetupSchedule agent={agent} actions={actions} onNext={onSaved} saveLabel={SAVE} inPlace />}
      </Section>
      <Section title="Clients and targets" description="Who Birdy watches and what a good cost per lead is for each.">
        {(onSaved) => (
          <SetupClients agent={agent} clients={clients} actions={actions} flagOnly={flagOnly} setFlagOnly={setFlagOnly} onNext={onSaved} saveLabel={SAVE} inPlace />
        )}
      </Section>
      <Section title="Creative rules" description="The limits behind removing, adding and reviving ads.">
        {(onSaved) => <SetupCreative agent={agent} actions={actions} onNext={onSaved} saveLabel={SAVE} inPlace />}
      </Section>
      <Section title="Slack" description="Where cards and reports go, and how the messages look.">
        {(onSaved) => (
          <div className="flex flex-col gap-6">
            <SetupSlack agent={agent} actions={actions} onNext={onSaved} saveLabel={SAVE} inPlace />
            <div className="max-w-3xl">
              <SlackTemplates agentId={agent.id} actions={actions} />
            </div>
          </div>
        )}
      </Section>
    </div>
  )
}
