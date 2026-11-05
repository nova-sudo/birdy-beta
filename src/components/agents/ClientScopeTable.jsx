"use client"

import * as React from "react"
import Link from "next/link"
import { Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import { setClientTarget } from "@/lib/agents-api"
import { currencySymbol } from "@/lib/chat-viz"
import { Button, Checkbox, Frame, Input, SearchInput } from "@/components/ds"

/** Where a client's Meta account is connected: its page, with the settings dialog on Integrations. */
export const integrationsHref = (gid) => `/clients/${encodeURIComponent(gid)}?settings=integrations`

const fmt = (n) => (n == null || n === "" ? "" : String(n))

/** Parses a field: "" is null (cleared), anything else must be a number >= 0, or it is invalid. */
function parseField(raw) {
  const text = String(raw).trim()
  if (text === "") return { ok: true, value: null }
  const n = Number(text)
  return Number.isFinite(n) && n >= 0 ? { ok: true, value: n } : { ok: false }
}

function TargetField({ client, watched, agentId }) {
  const [draft, setDraft] = React.useState(fmt(client.cpl))
  const saved = React.useRef(client.cpl ?? null)
  const [state, setState] = React.useState(null) // null | "saving" | "error"

  React.useEffect(() => {
    saved.current = client.cpl ?? null
    setDraft(fmt(client.cpl))
  }, [client.cpl])

  const commit = async () => {
    const parsed = parseField(draft)
    if (!parsed.ok) {
      setDraft(fmt(saved.current))
      return
    }
    if (parsed.value === saved.current) return
    setState("saving")
    try {
      // The target belongs to the client, so this saves whether or not it is watched.
      await setClientTarget(agentId, client.id, parsed.value)
      saved.current = parsed.value
      setState(null)
    } catch {
      setState("error")
    }
  }

  // Only a watched client needs one: activation wants a target on every watched client.
  const missing = watched && draft.trim() === ""
  return (
    <div className="flex w-24 flex-col items-end gap-0.5">
      <div className="relative w-full">
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground"
        >
          {currencySymbol(client.currency)}
        </span>
        <Input
          size="sm"
          inputMode="decimal"
          placeholder="Set"
          aria-label={`CPL target for ${client.name}`}
          aria-busy={state === "saving" || undefined}
          warning={missing}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            if (state === "error") setState(null)
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur()
          }}
          className="pl-7 text-right font-mono"
        />
      </div>
      {state === "error" && <span className="text-xs text-danger-ink">Not saved</span>}
    </div>
  )
}

function CapField({ client, enabled, cap, globalCap, onCapChange }) {
  const [draft, setDraft] = React.useState(fmt(cap))

  React.useEffect(() => {
    setDraft(fmt(cap))
  }, [cap])

  const commit = () => {
    const parsed = parseField(draft)
    if (!parsed.ok) {
      setDraft(fmt(cap))
      return
    }
    const value = parsed.value == null ? null : Math.round(parsed.value)
    if (value === (cap ?? null)) return
    onCapChange(client.id, value)
  }

  return (
    <Input
      size="sm"
      inputMode="numeric"
      placeholder={fmt(globalCap)}
      aria-label={`Max pauses per day for ${client.name}`}
      disabled={!enabled}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur()
      }}
      className="w-24 text-right font-mono"
    />
  )
}

/**
 * Which clients the agent watches, with each one's CPL target and pause cap inline.
 *
 * Selection and caps are the page's (saved on Next and on blur). A target saves itself on blur
 * through `setClientTarget`; it belongs to the client, so it never changes what is watched.
 *
 * @param {object} props
 * @param {string} props.agentId
 * @param {{id: string, name: string, account: string|null, currency: string|null, cpl: number|null}[]} props.clients
 *   `account` null means no Meta ad account is connected
 * @param {string[]} props.selected
 * @param {(ids: string[]) => void} props.onSelectedChange
 * @param {Record<string, number>} [props.caps] Per-client max pauses per day
 * @param {(gid: string, cap: number|null) => void} props.onCapChange `null` falls back to the global cap
 * @param {number} [props.globalCap=3]
 */
export function ClientScopeTable({
  agentId,
  clients,
  selected,
  onSelectedChange,
  caps = {},
  onCapChange,
  globalCap = 3,
  className,
}) {
  const [query, setQuery] = React.useState("")
  const chosen = React.useMemo(() => new Set(selected), [selected])

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? clients.filter((c) => c.name.toLowerCase().includes(q)) : clients
  }, [clients, query])

  const selectable = visible.filter((c) => c.account)
  const allChosen = selectable.length > 0 && selectable.every((c) => chosen.has(c.id))

  const setChosen = (next) => onSelectedChange(clients.filter((c) => next.has(c.id)).map((c) => c.id))

  const toggleAll = () => {
    const next = new Set(chosen)
    for (const c of selectable) {
      if (allChosen) next.delete(c.id)
      else next.add(c.id)
    }
    setChosen(next)
  }

  const toggle = (id, on) => {
    const next = new Set(chosen)
    if (on) next.add(id)
    else next.delete(id)
    setChosen(next)
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Frame
        aria-label="Clients to watch"
        toolbar={
          <>
            <SearchInput
              size="sm"
              value={query}
              onChange={setQuery}
              debounceMs={0}
              placeholder="Search clients"
              className="min-w-0 flex-1"
            />
            <span className="text-sm text-muted-foreground tabular-nums">
              {selected.length} of {clients.length} watched
            </span>
            <Button size="sm" onClick={toggleAll} disabled={selectable.length === 0}>
              {allChosen ? "Clear all" : "Select all"}
            </Button>
          </>
        }
      >
        <div
          aria-hidden
          className="flex items-center gap-3 px-4 pt-2.5 pb-2 text-xs text-muted-foreground max-sm:hidden"
        >
          <span className="w-4" />
          <span className="flex-1">Client</span>
          <span className="w-24 text-right">CPL target</span>
          <span className="w-24 text-right">Max pauses/day</span>
        </div>
        <ul className="divide-y divide-divider">
          {visible.map((client) => {
            const connected = Boolean(client.account)
            const on = chosen.has(client.id)
            return (
              <li
                key={client.id}
                data-slot="client-row"
                className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3", !connected && "opacity-60")}
              >
                <Checkbox
                  checked={on}
                  disabled={!connected}
                  onCheckedChange={(v) => toggle(client.id, v === true)}
                  aria-label={`Watch ${client.name}`}
                />
                <div className="flex min-w-0 flex-1 basis-40 flex-col">
                  <span className="truncate text-base font-medium text-foreground">{client.name}</span>
                  <span className={cn("truncate text-xs text-muted-foreground", connected && "font-mono")}>
                    {connected ? client.account : "No Meta account connected"}
                  </span>
                </div>
                {connected ? (
                  <div className="ml-auto flex items-start gap-3">
                    <TargetField client={client} watched={on} agentId={agentId} />
                    <CapField
                      client={client}
                      enabled={on}
                      cap={caps[client.id]}
                      globalCap={globalCap}
                      onCapChange={onCapChange}
                    />
                  </div>
                ) : (
                  <Button asChild size="sm" className="ml-auto">
                    <Link href={integrationsHref(client.id)}>Connect</Link>
                  </Button>
                )}
              </li>
            )
          })}
          {visible.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">
              {clients.length === 0 ? "No clients yet." : "No clients match that search."}
            </li>
          )}
          <li className="px-4 py-2.5">
            <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
              <Link href="/settings?tab=integrations">
                <Plus aria-hidden />
                Connect another Meta account
              </Link>
            </Button>
          </li>
        </ul>
      </Frame>
      <p className="text-xs text-muted-foreground">
        Targets save back to each client, so Alerts and hubs use them too. A blank max uses the global safety limit.
      </p>
    </div>
  )
}
