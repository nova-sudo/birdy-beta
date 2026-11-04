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
import { ClientsBulkBar } from "./ClientsBulkBar"
import { ErrorNotice, SetupFooter, clientErrors, parseNumber, saveMessage, settingsOf, show } from "./SetupShared"

const NO_TREATMENT = "__none"

/** The currency most watched clients are in, as a code. */
function commonCurrency(clients, ids) {
  const counts = new Map()
  for (const c of clients) if (ids.includes(c.id) && c.currency) counts.set(c.currency, (counts.get(c.currency) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

// Every client follows Your zones until someone gives it its own: `own` is whether its limits are open for editing.
function startingRow(stored, firstBatch) {
  const zones = stored?.zones ?? {}
  return {
    batch_id: stored?.batch_id ?? firstBatch,
    treatment_ids: stored?.treatment_ids ?? [],
    own: zones.green_under != null || zones.red_over != null,
    green: show(zones.green_under),
    red: show(zones.red_over),
    prepaid: Boolean(stored?.prepaid),
  }
}

const hasOwnLimits = (row) => row.green.trim() !== "" || row.red.trim() !== ""

const nameList = (names) => (names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0])

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
 * Step 2: zones for the whole agency, then one table. Every client follows those zones with no treatment
 * until someone changes it, on its row or by ticking several and using the bulk bar. Saves through `patchSettings`.
 */
export function SetupClients({ agent, clients, actions, flagOnly, setFlagOnly, onBack, onNext, saveLabel, inPlace = false }) {
  const settings = useMemo(() => settingsOf(agent), [agent])
  const firstBatch = settings.batches[0]?.id ?? null
  // A client deleted since it was chosen is dropped, so it isn't sent back.
  const storedIds = (agent.scope?.client_group_ids ?? []).filter((id) => clients.some((c) => c.id === id))

  const [selected, setSelected] = useState(() => (storedIds.length ? storedIds : clients.filter((c) => c.account).map((c) => c.id)))
  const [rows, setRows] = useState(() =>
    Object.fromEntries(clients.map((c) => [c.id, startingRow(settings.clients[c.id], firstBatch)]))
  )
  const [defaults, setDefaults] = useState(() => ({
    currency: settings.zones.currency ?? commonCurrency(clients, storedIds.length ? storedIds : clients.filter((c) => c.account).map((c) => c.id)),
    green: show(settings.zones.green_under),
    red: show(settings.zones.red_over),
  }))
  const [treatments, setTreatments] = useState(settings.treatments)
  const [newTreatment, setNewTreatment] = useState(null)
  const [picked, setPicked] = useState([])
  const [justOpened, setJustOpened] = useState(null)
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
  const rowFor = (c) => rows[c.id] ?? startingRow(settings.clients[c.id], firstBatch)
  const setRowsFor = (gids, patch) => {
    setRows((r) => {
      const next = { ...r }
      for (const gid of gids) next[gid] = { ...(r[gid] ?? startingRow(settings.clients[gid], firstBatch)), ...patch }
      return next
    })
    setServerRowErrors((e) => {
      const next = { ...e }
      for (const gid of gids) delete next[gid]
      return next
    })
  }
  const setRow = (gid, patch) => setRowsFor([gid], patch)
  const useYourZones = (gids) => setRowsFor(gids, { own: false, green: "", red: "" })
  const toggle = (gid, on) => setSelected((ids) => (on ? [...new Set([...ids, gid])] : ids.filter((i) => i !== gid)))

  const pickable = clients.filter((c) => c.account)
  const pickedClients = pickable.filter((c) => picked.includes(c.id))
  const pickedIds = pickedClients.map((c) => c.id)
  const allPicked = pickable.length > 0 && pickedClients.length === pickable.length

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
      // Setup moves to the next step, so the button stays busy until the page changes; in settings it is done.
      if (inPlace) setSaving(false)
    } catch (err) {
      if (err?.status === 409 && err.conflicts?.length) setConflicts(err.conflicts)
      else {
        setServerRowErrors(clientErrors(err))
        setError(saveMessage(err))
      }
      setSaving(false)
    }
  }

  // The default can't be used until it is complete, and it never covers another currency.
  const followers = watched.filter((c) => !hasOwnLimits(rowFor(c)))
  const needsOwn = defaults.currency ? followers.filter((c) => c.currency !== defaults.currency) : []
  const defaultMissing = dg.value == null || dr.value == null || !defaults.currency
  const waitingForDefault = defaultMissing && followers.length > needsOwn.length
  const count = (test) => watched.filter((c) => test(rowFor(c))).length
  const summary = [
    `${selected.length} of ${clients.length} watched`,
    `${followers.length} on your zones`,
    `${watched.length - followers.length} with their own`,
    `${count((r) => r.treatment_ids.length > 0)} with a treatment`,
    `${count((r) => r.prepaid)} prepaid`,
  ].join(" · ")

  return (
    <div className="flex flex-col gap-6">
      <Frame title="Your zones" description="Every client uses these unless you give it its own below." padded contentClassName="flex flex-col gap-3">
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
        {waitingForDefault && !defaultProblem && (
          <p className="text-xs text-muted-foreground">Pick a currency and set both limits, so your clients have zones to follow.</p>
        )}
      </Frame>

      <Frame
        title="Clients"
        description="Tick clients to set targets, treatment or prepaid for all of them. A client with no treatment never gets another client's ads, and its ads are never offered to another client."
        action={
          <Button size="sm" variant="ghost" onClick={() => setNewTreatment("")}>
            <Plus aria-hidden />
            Add a treatment
          </Button>
        }
        footer={summary}
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
                <th className="w-10 px-3 py-2">
                  <Checkbox
                    aria-label="Select all clients"
                    checked={allPicked ? true : pickedClients.length ? "indeterminate" : false}
                    disabled={pickable.length === 0}
                    onCheckedChange={(v) => setPicked(v === true ? pickable.map((c) => c.id) : [])}
                  />
                </th>
                <th className="px-3 py-2 font-medium">Client</th>
                <th className="px-3 py-2 font-medium">Targets</th>
                <th className="px-3 py-2 font-medium">Batch</th>
                <th className="px-3 py-2 font-medium">Treatment</th>
                <th className="px-3 py-2 font-medium">Prepaid</th>
                <th className="px-3 py-2 font-medium">Watch</th>
                <th className="px-3 py-2"><span className="sr-only">Targets action</span></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const on = chosen.has(c.id)
                const row = rowFor(c)
                const isPicked = pickedIds.includes(c.id)
                // A client following the default is explained by its badge and the notes around the table.
                const message = on ? serverRowErrors[c.id] || (hasOwnLimits(row) ? problems[c.id] : null) : null
                const sym = currencySymbol(c.currency)
                const needs = needsOwn.includes(c)
                return (
                  <tr key={c.id} className={isPicked ? "border-t bg-primary-soft align-middle" : "border-t align-middle"}>
                    <td className="px-3 py-2">
                      <Checkbox
                        aria-label={`Select ${c.name}`}
                        checked={isPicked}
                        disabled={!c.account}
                        onCheckedChange={(v) => setPicked((ids) => (v === true ? [...ids, c.id] : ids.filter((i) => i !== c.id)))}
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
                          {row.own ? (
                            <div className="flex items-center gap-2">
                              {["green", "red"].map((key) => (
                                <div key={key} className="relative w-24">
                                  {sym && (
                                    <span aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">
                                      {sym}
                                    </span>
                                  )}
                                  <Input
                                    size="sm"
                                    inputMode="decimal"
                                    autoFocus={key === "green" && justOpened === c.id}
                                    placeholder={key === "green" ? "Green" : "Red"}
                                    aria-label={`${key === "green" ? "Green under" : "Red over"} for ${c.name}`}
                                    warning={Boolean(message)}
                                    value={row[key]}
                                    onChange={(e) => setRow(c.id, { [key]: e.target.value })}
                                    className="pl-7 text-right font-mono"
                                  />
                                </div>
                              ))}
                            </div>
                          ) : needs ? (
                            <Badge tone="warning" size="sm" title={problems[c.id] ?? undefined}>
                              {c.currency ? `Needs its own, in ${c.currency}` : "Needs its own"}
                            </Badge>
                          ) : (
                            <Badge tone="neutral" size="sm">Your zones</Badge>
                          )}
                        </td>
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
                        <td className="px-3 py-2">
                          <Switch aria-label={`Prepaid ${c.name}`} checked={row.prepaid} onCheckedChange={(v) => setRow(c.id, { prepaid: v })} />
                        </td>
                      </>
                    ) : (
                      <td colSpan={4} className="px-3 py-2 text-muted-foreground">
                        {c.account ? "Not watched" : ""}
                      </td>
                    )}
                    <td className="px-3 py-2">
                      <Switch aria-label={`Watch ${c.name}`} checked={on} disabled={!c.account} onCheckedChange={(v) => toggle(c.id, v)} />
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {on && (row.own ? (
                        <Button size="sm" variant="link" onClick={() => useYourZones([c.id])}>
                          Use your zones
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="link"
                          onClick={() => {
                            setJustOpened(c.id)
                            setRow(c.id, { own: true })
                          }}
                        >
                          Set targets
                        </Button>
                      ))}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Frame>

      {pickedClients.length > 0 && (
        <ClientsBulkBar
          picked={pickedClients}
          watching={chosen}
          batches={settings.batches}
          treatmentOptions={[{ value: NO_TREATMENT, label: "No treatment" }, ...treatments.map((t) => ({ value: t.id, label: t.name }))]}
          onTreatment={(v) => setRowsFor(pickedIds, { treatment_ids: v === NO_TREATMENT ? [] : [v] })}
          onChange={(patch) => setRowsFor(pickedIds, patch)}
          onSetTargets={(green, red) => setRowsFor(pickedIds, { own: true, green, red })}
          onUseZones={() => useYourZones(pickedIds)}
          onWatch={(on) => setSelected((ids) => (on ? [...new Set([...ids, ...pickedIds])] : ids.filter((i) => !pickedIds.includes(i))))}
          onClear={() => setPicked([])}
        />
      )}

      {needsOwn.length > 0 && (
        <Notice tone="warning">
          {nameList(needsOwn.map((c) => c.name))} {needsOwn.length > 1 ? "bill" : "bills"} in a different currency from your zones, so {needsOwn.length > 1 ? "each needs its" : "it needs its"} own targets before you can continue.
        </Notice>
      )}
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
