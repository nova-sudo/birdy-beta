"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Plus } from "lucide-react"

import {
  Badge,
  Button,
  Checkbox,
  Frame,
  Input,
  Label,
  Notice,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SegmentedTabs,
  Switch,
} from "@/components/ds"
import { ClaimConflicts } from "@/components/agents/ClaimConflicts"
import { integrationsHref } from "@/components/agents/ClientScopeTable"
import { currencySymbol } from "@/lib/chat-viz"
import { ErrorNotice, SetupFooter, clientErrors, parseNumber, saveMessage, settingsOf, show } from "./SetupShared"

const NO_TREATMENT = "__none"

/** The currency most watched clients are in, as a code. */
function commonCurrency(clients, ids) {
  const counts = new Map()
  for (const c of clients) if (ids.includes(c.id) && c.currency) counts.set(c.currency, (counts.get(c.currency) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

function startingRow(client, stored, firstBatch) {
  const own = stored?.zones ?? {}
  return {
    batch_id: stored?.batch_id ?? firstBatch,
    treatment_ids: stored?.treatment_ids ?? [],
    // The green limit starts from the client's CPL target, as the server does the first time a client is added.
    // Only a client whose zones were never saved starts from its CPL target. A limit saved as empty stays empty.
    green: show(stored?.zones == null ? (own.green_under ?? client.cpl) : own.green_under),
    red: show(own.red_over),
    prepaid: Boolean(stored?.prepaid),
  }
}

/**
 * What stops a client's zones from resolving, in the server's words, or null. Mirrors the server's
 * check: a partial override fails, and without one the default only covers an account in its currency.
 */
export function zoneProblem(client, row, defaults) {
  const g = parseNumber(row.green)
  const r = parseNumber(row.red)
  if (!g.ok || !r.ok) return "Zone limits must be numbers, 0 or more."
  if (g.value != null || r.value != null) {
    if (g.value == null || r.value == null) {
      return `${client.name} has only one zone limit set; it needs a ${g.value == null ? "green" : "red"} limit too`
    }
    return r.value < g.value ? `${client.name}: red must be at least the green limit` : null
  }
  const dg = parseNumber(defaults.green)
  const dr = parseNumber(defaults.red)
  const covered = defaults.currency && client.currency === defaults.currency && dg.value != null && dr.value != null
  if (covered) return null
  if (defaults.currency && client.currency && client.currency !== defaults.currency) {
    return `${client.name} needs its own zones: its account is in ${client.currency}, which the default zones (${defaults.currency}) don't cover`
  }
  return `${client.name} needs its own zones: set the default zones above, or give this client its own limits`
}

function RowSeg({ batches, value, onChange, name }) {
  return (
    <SegmentedTabs
      size="sm"
      ariaLabel={`Batch for ${name}`}
      value={value ?? ""}
      onValueChange={onChange}
      items={batches.map((b) => ({ value: b.id, label: b.name.replace(/^Batch\s+/i, "") }))}
    />
  )
}

/**
 * Step 2: zones for the whole agency, then one table: who is watched, which batch, which treatment, any
 * zone override and whether the account is prepaid. Saves through `patchSettings`.
 */
export function SetupClients({ agent, clients, actions, flagOnly, setFlagOnly, onBack, onNext, saveLabel }) {
  const settings = useMemo(() => settingsOf(agent), [agent])
  const firstBatch = settings.batches[0]?.id ?? null
  // A client deleted since it was chosen is dropped, so it isn't sent back.
  const storedIds = (agent.scope?.client_group_ids ?? []).filter((id) => clients.some((c) => c.id === id))

  const [selected, setSelected] = useState(() => (storedIds.length ? storedIds : clients.filter((c) => c.account).map((c) => c.id)))
  const [rows, setRows] = useState(() =>
    Object.fromEntries(clients.map((c) => [c.id, startingRow(c, settings.clients[c.id], firstBatch)]))
  )
  const [defaults, setDefaults] = useState(() => ({
    currency: settings.zones.currency ?? commonCurrency(clients, storedIds.length ? storedIds : clients.filter((c) => c.account).map((c) => c.id)),
    green: show(settings.zones.green_under),
    red: show(settings.zones.red_over),
  }))
  const [treatments, setTreatments] = useState(settings.treatments)
  const [newTreatment, setNewTreatment] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [serverRowErrors, setServerRowErrors] = useState({})
  const [conflicts, setConflicts] = useState(null)

  const chosen = useMemo(() => new Set(selected), [selected])
  const currencies = useMemo(() => {
    const codes = new Set(clients.map((c) => c.currency).filter(Boolean))
    if (defaults.currency) codes.add(defaults.currency)
    return codes.size ? [...codes].sort() : ["GBP", "USD", "EUR"]
  }, [clients, defaults.currency])

  // A client that arrived after this step opened (an import finishing) starts from its own defaults.
  const rowFor = (c) => rows[c.id] ?? startingRow(c, settings.clients[c.id], firstBatch)
  const setRow = (gid, patch) => {
    const client = clients.find((c) => c.id === gid)
    setRows((r) => ({ ...r, [gid]: { ...(r[gid] ?? startingRow(client, settings.clients[gid], firstBatch)), ...patch } }))
    setServerRowErrors((e) => (e[gid] ? { ...e, [gid]: undefined } : e))
  }
  const toggle = (gid, on) => setSelected((ids) => (on ? [...ids, gid] : ids.filter((i) => i !== gid)))

  const dg = parseNumber(defaults.green)
  const dr = parseNumber(defaults.red)
  const defaultProblem = !dg.ok || !dr.ok
    ? "Zone limits must be numbers, 0 or more."
    : dg.value != null && dr.value != null && dr.value < dg.value
      ? "Red must be at least the green limit."
      : null

  const watched = clients.filter((c) => chosen.has(c.id))
  const problems = Object.fromEntries(watched.map((c) => [c.id, zoneProblem(c, rowFor(c), defaults)]))
  const blocked = selected.length === 0 || Boolean(defaultProblem) || Object.values(problems).some(Boolean)

  const addTreatment = () => {
    const name = newTreatment.trim()
    if (name && !treatments.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "treatment"
      let id = base
      for (let n = 2; treatments.some((t) => t.id === id); n += 1) id = `${base}-${n}`
      setTreatments((t) => [...t, { id, name }])
    }
    setNewTreatment(null)
  }

  // `extra` is {move_claims} or {only_flag} when answering a conflict. The server only honours `only_flag`
  // together with the client list, which every save here sends, so a client flagged earlier stays flagged.
  const save = async (extra = {}) => {
    setSaving(true)
    setError(null)
    setConflicts(null)
    setServerRowErrors({})
    const only = extra.only_flag ?? flagOnly
    const clientsPatch = {}
    for (const gid of Object.keys(settings.clients)) if (!chosen.has(gid)) clientsPatch[gid] = null
    for (const c of watched) {
      const row = rowFor(c)
      const stored = settings.clients[c.id]
      clientsPatch[c.id] = {
        batch_id: row.batch_id,
        treatment_ids: row.treatment_ids,
        zones: { green_under: parseNumber(row.green).value, red_over: parseNumber(row.red).value },
        prepaid: row.prepaid ? (stored?.prepaid ?? { topups: [] }) : null,
      }
    }
    try {
      await actions.patchSettings({
        settings: {
          zones: { currency: defaults.currency, green_under: dg.value, red_over: dr.value },
          treatments,
          clients: clientsPatch,
        },
        client_group_ids: selected,
        only_flag: only,
        ...(extra.move_claims ? { move_claims: true } : {}),
      })
      onNext()
      setSaving(false)
    } catch (err) {
      if (err?.status === 409 && err.conflicts?.length) setConflicts(err.conflicts)
      else {
        setServerRowErrors(clientErrors(err))
        setError(saveMessage(err))
      }
      setSaving(false)
    }
  }

  const noMatch = defaults.currency && watched.some((c) => c.currency && c.currency !== defaults.currency)

  return (
    <div className="flex flex-col gap-6">
      <Frame title="Your zones" description="The default for every client in this currency. Override any client below." padded contentClassName="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <Label id="stock-zone-currency" className="text-xs text-muted-foreground">
              Currency
            </Label>
            <Select value={defaults.currency ?? undefined} onValueChange={(currency) => setDefaults((d) => ({ ...d, currency }))}>
              <SelectTrigger aria-labelledby="stock-zone-currency" className="w-28">
                <SelectValue placeholder="Pick" />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="stock-zone-green" className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span aria-hidden className="size-2 rounded-full bg-success" />
              Green under
            </Label>
            <Input id="stock-zone-green" inputMode="decimal" className="w-32 text-right font-mono" value={defaults.green} warning={Boolean(defaultProblem)} onChange={(e) => setDefaults((d) => ({ ...d, green: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="stock-zone-red" className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span aria-hidden className="size-2 rounded-full bg-danger" />
              Red over
            </Label>
            <Input id="stock-zone-red" inputMode="decimal" className="w-32 text-right font-mono" value={defaults.red} warning={Boolean(defaultProblem)} onChange={(e) => setDefaults((d) => ({ ...d, red: e.target.value }))} />
          </div>
          <p className="pb-2 text-sm text-muted-foreground">
            <span aria-hidden className="mr-1.5 inline-block size-2 rounded-full bg-warning" />
            Yellow is anything in between
          </p>
        </div>
        {defaultProblem && (
          <p role="alert" className="text-xs text-danger-ink">
            {defaultProblem}
          </p>
        )}
        {noMatch && (
          <p className="text-xs text-muted-foreground">
            Clients whose account is not in {defaults.currency} can't use these numbers. Give each its own limits below.
          </p>
        )}
      </Frame>

      <Frame
        title="Clients"
        description="A client with no treatment never gets another client's ads, and its ads are never offered to another client."
        action={
          <Button size="sm" variant="ghost" onClick={() => setNewTreatment("")}>
            <Plus aria-hidden />
            Add a treatment
          </Button>
        }
        footer={`${selected.length} of ${clients.length} watched`}
      >
        {newTreatment !== null && (
          <form
            className="flex items-center gap-2 p-3"
            onSubmit={(e) => {
              e.preventDefault()
              addTreatment()
            }}
          >
            <Input size="sm" autoFocus aria-label="Treatment name" placeholder="Treatment, like Skin" value={newTreatment} onChange={(e) => setNewTreatment(e.target.value)} className="max-w-64" />
            <Button size="sm" variant="primary" type="submit" disabled={!newTreatment.trim()}>
              Add
            </Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => setNewTreatment(null)}>
              Cancel
            </Button>
          </form>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="w-10 px-3 py-2"><span className="sr-only">Watch</span></th>
                <th className="px-3 py-2 font-medium">Client</th>
                <th className="px-3 py-2 font-medium">Batch</th>
                <th className="px-3 py-2 font-medium">Treatment</th>
                <th className="px-3 py-2 text-right font-medium">Green under</th>
                <th className="px-3 py-2 text-right font-medium">Red over</th>
                <th className="px-3 py-2 font-medium">Prepaid</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const on = chosen.has(c.id)
                const row = rowFor(c)
                const message = on ? serverRowErrors[c.id] || problems[c.id] : null
                const sym = currencySymbol(c.currency)
                return (
                  <tr key={c.id} className="border-t align-top">
                    <td className="px-3 py-2">
                      <Checkbox
                        aria-label={`Watch ${c.name}`}
                        checked={on}
                        disabled={!c.account}
                        onCheckedChange={(v) => toggle(c.id, v === true)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className={c.account ? "font-medium text-foreground" : "font-medium text-muted-foreground"}>{c.name}</div>
                      {!c.account && (
                        <p className="text-xs text-muted-foreground">
                          No Meta ad account is connected.{" "}
                          <Link href={integrationsHref(c.id)} className="underline">
                            Connect one
                          </Link>
                        </p>
                      )}
                      {on && flagOnly.includes(c.id) && <Badge tone="info" size="sm">Only flag</Badge>}
                      {message && (
                        <p role="alert" className="mt-1 text-xs text-danger-ink">
                          {message}
                        </p>
                      )}
                    </td>
                    {on ? (
                      <>
                        <td className="px-3 py-2">
                          <RowSeg batches={settings.batches} value={row.batch_id} name={c.name} onChange={(v) => setRow(c.id, { batch_id: v })} />
                        </td>
                        <td className="px-3 py-2">
                          <Select
                            value={row.treatment_ids[0] ?? NO_TREATMENT}
                            onValueChange={(v) => setRow(c.id, { treatment_ids: v === NO_TREATMENT ? [] : [v] })}
                          >
                            <SelectTrigger size="sm" aria-label={`Treatment for ${c.name}`} className="w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NO_TREATMENT}>No treatment</SelectItem>
                              {treatments.map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                  {t.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        {["green", "red"].map((key) => (
                          <td key={key} className="px-3 py-2 text-right">
                            <div className="relative ml-auto w-28">
                              {sym && (
                                <span aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">
                                  {sym}
                                </span>
                              )}
                              <Input
                                size="sm"
                                inputMode="decimal"
                                placeholder="Default"
                                aria-label={`${key === "green" ? "Green under" : "Red over"} for ${c.name}`}
                                warning={Boolean(message)}
                                value={row[key]}
                                onChange={(e) => setRow(c.id, { [key]: e.target.value })}
                                className="pl-7 text-right font-mono"
                              />
                            </div>
                          </td>
                        ))}
                        <td className="px-3 py-2">
                          <Switch aria-label={`Prepaid ${c.name}`} checked={row.prepaid} onCheckedChange={(v) => setRow(c.id, { prepaid: v })} />
                        </td>
                      </>
                    ) : (
                      <td colSpan={5} className="px-3 py-2 text-muted-foreground">
                        Not watched
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Frame>

      {selected.length === 0 && <Notice tone="warning">Pick at least one client for it to watch.</Notice>}
      <ErrorNotice>{error}</ErrorNotice>
      {conflicts && (
        <ClaimConflicts
          conflicts={conflicts}
          clients={clients}
          busy={saving}
          onMove={() => save({ move_claims: true })}
          onOnlyFlag={(gid) => {
            const all = flagOnly.includes(gid) ? flagOnly : [...flagOnly, gid]
            setFlagOnly(all)
            save({ only_flag: all })
          }}
        />
      )}
      <SetupFooter onBack={onBack} onNext={() => save()} saving={saving} disabled={blocked} label={saveLabel} />
    </div>
  )
}
