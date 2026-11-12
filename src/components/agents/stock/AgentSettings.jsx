"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { Button, Tabs, TabsContent, TabsList, TabsTrigger, confirm } from "@/components/ds"
import { STOCK_SETUP_PATH } from "@/lib/stock-agent-api"
import { ModesTable, modesOf, modesPatches } from "./ModesTable"
import { ErrorNotice, SetupFooter, clientErrors, saveMessage, settingsOf } from "./SetupShared"
import { SetupClients } from "./SetupClients"
import { SetupCreative } from "./SetupCreative"
import { SetupSchedule } from "./SetupSchedule"
import { SetupSlack } from "./SetupSlack"
import { SlackTemplates } from "./SlackTemplates"
import { TurnOn } from "./TurnOn"

const SAVE = "Save changes"

/** The Settings sub-tabs, in order, with the labels of spec §4.2. The page syncs the value to `?section=`. */
export const SETTINGS_SECTIONS = [
  { value: "modes", label: "What it can change" },
  { value: "schedule", label: "Schedule" },
  { value: "clients", label: "Clients and targets" },
  { value: "creative", label: "Creative rules" },
  { value: "slack", label: "Slack" },
]
const isSection = (value) => SETTINGS_SECTIONS.some((s) => s.value === value)

const DEFAULT_TIME = "07:00"
const DEFAULT_TZ = "Europe/London"

/** The hour and minute, as "HH:MM", of `now` in the time zone `tz`. */
function localTime(now, tz) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now)
    const get = (type) => parts.find((p) => p.type === type)?.value ?? "00"
    return `${get("hour")}:${get("minute")}`
  } catch {
    return localTime(now, DEFAULT_TZ)
  }
}

/**
 * When the agent next checks, as "today 07:00" or "tomorrow 07:00". A run starts every day at the schedule's
 * time in the agent's zone (a batch day carries cards, the others alerts only), so it is today until that time
 * has passed.
 */
export function nextCheckLabel(agent, now = new Date()) {
  const schedule = agent?.scope?.schedule ?? {}
  const time = schedule.time || DEFAULT_TIME
  return `${localTime(now, schedule.tz || DEFAULT_TZ) < time ? "today" : "tomorrow"} ${time}`
}

/** A settings section. Its form calls `onSaved` when it has saved, which shows "Saved." above it. */
function Section({ title, children }) {
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    if (!saved) return undefined
    const timer = setTimeout(() => setSaved(false), 5000)
    return () => clearTimeout(timer)
  }, [saved])
  return (
    <section aria-label={`${title} settings`} className="flex flex-col gap-3">
      {saved && (
        <p role="status" className="self-end text-xs text-muted-foreground">
          Saved.
        </p>
      )}
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
function TurnOff({ actions, size }) {
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
      <Button variant="outline" size={size} loading={busy} onClick={press}>
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
 * The line beside the page's tabs while Settings is open: Live with the next check, Review setup and Turn off;
 * Turned off with Turn on; or Not on yet with Finish setup.
 *
 * @param {object} props
 * @param {object} props.agent The full agent
 * @param {object[]} [props.clients] `toClient` shapes, for Turn on's conflict names
 * @param {ReturnType<import("@/lib/stock-agent-api").useStockActions>} props.actions
 * @param {Date} [props.now] For the next check; now by default
 */
export function SettingsStatus({ agent, clients = [], actions, now }) {
  const live = agent.status === "active"
  const turnedOff = !live && Boolean(agent.turned_off_at)
  return (
    <div role="status" aria-label="Agent status" className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-sm">
      {live ? (
        <>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span aria-hidden className="relative flex size-2">
              <span className="absolute inline-flex size-full rounded-full bg-success opacity-60 motion-safe:animate-ping" />
              <span className="relative inline-flex size-2 rounded-full bg-success" />
            </span>
            <b className="font-semibold text-success-ink">Live</b>
            <span className="tabular-nums">· next check {nextCheckLabel(agent, now ?? new Date())}</span>
          </span>
          <Link href={STOCK_SETUP_PATH} className="inline-flex items-center gap-0.5 font-medium text-primary-ink hover:underline">
            Review setup
            <ChevronRight aria-hidden className="size-4" />
          </Link>
          <TurnOff actions={actions} size="sm" />
        </>
      ) : turnedOff ? (
        <>
          <span className="font-semibold text-muted-foreground">Turned off</span>
          <TurnOn agent={agent} clients={clients} size="sm" />
        </>
      ) : (
        <>
          <span className="font-semibold text-muted-foreground">Not on yet</span>
          <Link href={STOCK_SETUP_PATH} className="inline-flex items-center gap-0.5 font-medium text-primary-ink hover:underline">
            Finish setup
            <ChevronRight aria-hidden className="size-4" />
          </Link>
        </>
      )}
    </div>
  )
}

/**
 * The Settings tab: the same forms as setup, saved in place, one sub-tab at a time. Every section stays
 * mounted (hidden when not shown), so a draft survives switching sub-tabs. A change to clients can hit another
 * agent's claim, and a refused save names the row it is about. The status line is `SettingsStatus`, which the
 * page shows beside its tabs.
 *
 * @param {object} props
 * @param {object} props.agent The full agent (`settings`, `scope`, `add_writes_enabled`)
 * @param {object[]} props.clients `toClient` shapes for every client group
 * @param {ReturnType<import("@/lib/stock-agent-api").useStockActions>} props.actions
 * @param {string} [props.section] The open sub-tab (`SETTINGS_SECTIONS` values); the page passes `?section=`.
 *   Without it the component keeps its own, starting on Clients and targets when `focusClient` is set
 * @param {(section: string) => void} [props.onSection] Called when a sub-tab is picked
 * @param {string} [props.focusClient] A client group id to scroll to and highlight on Clients and targets
 */
export function AgentSettings({ agent, clients, actions, section, onSection, focusClient }) {
  // The server takes only_flag as the whole list, so clients flagged earlier ride along on every save.
  const [flagOnly, setFlagOnly] = useState(() => agent.scope?.flag_only_client_group_ids ?? [])
  const [own, setOwn] = useState(() => (focusClient ? "clients" : "modes"))
  const current = section !== undefined && section !== null ? (isSection(section) ? section : "modes") : own
  const pick = (value) => {
    setOwn(value)
    onSection?.(value)
  }
  const label = (value) => SETTINGS_SECTIONS.find((s) => s.value === value).label

  const panels = {
    modes: (onSaved) => <ModesSection agent={agent} clients={clients} actions={actions} onSaved={onSaved} />,
    schedule: (onSaved) => <SetupSchedule agent={agent} actions={actions} onNext={onSaved} saveLabel={SAVE} inPlace />,
    clients: (onSaved) => (
      <SetupClients
        agent={agent}
        clients={clients}
        actions={actions}
        flagOnly={flagOnly}
        setFlagOnly={setFlagOnly}
        onNext={onSaved}
        saveLabel={SAVE}
        inPlace
        focusClient={current === "clients" ? focusClient : null}
      />
    ),
    creative: (onSaved) => <SetupCreative agent={agent} actions={actions} onNext={onSaved} saveLabel={SAVE} inPlace />,
    slack: (onSaved) => (
      <div className="flex flex-col gap-6">
        <SetupSlack agent={agent} actions={actions} onNext={onSaved} saveLabel={SAVE} inPlace />
        <SlackTemplates agentId={agent.id} actions={actions} />
      </div>
    ),
  }

  return (
    <Tabs value={current} onValueChange={pick} className="gap-6">
      <TabsList variant="underline" aria-label="Settings sections">
        {SETTINGS_SECTIONS.map((s) => (
          <TabsTrigger key={s.value} value={s.value}>
            {s.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {/* forceMount keeps every form (and its unsaved draft) alive; the ones not shown are hidden. */}
      {SETTINGS_SECTIONS.map(({ value }) => (
        <TabsContent key={value} value={value} forceMount hidden={value !== current}>
          <Section title={label(value)}>{panels[value]}</Section>
        </TabsContent>
      ))}
    </Tabs>
  )
}
