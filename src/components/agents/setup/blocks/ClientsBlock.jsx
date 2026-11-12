"use client"

import { useEffect, useRef, useState } from "react"

import { Notice, Skeleton } from "@/components/ds"
import { ClaimConflicts } from "@/components/agents/ClaimConflicts"
import { ClientScopeTable } from "@/components/agents/ClientScopeTable"
import { patchAgent } from "@/lib/agents-api"
import { moveClaims } from "../claims"
import { BlockFooter } from "./BlockFooter"

const picked = (n) => `Picked ${n} ${n === 1 ? "client" : "clients"}`

/**
 * Which clients the agent watches: a compact ClientScopeTable, saved through patchAgent. A client
 * another agent holds comes back as a 409; ClaimConflicts offers Move or Only flag right here.
 */
export function ClientsBlock({ agent, clients, clientsLoading, active, onSend, onSaved }) {
  const stored = agent?.scope?.client_group_ids ?? []
  const [selected, setSelected] = useState(() => (stored.length ? stored : clients.filter((c) => c.account).map((c) => c.id)))
  const [caps, setCaps] = useState(() => agent?.client_caps ?? {})
  const [flagOnly, setFlagOnly] = useState(() => agent?.scope?.flag_only_client_group_ids ?? [])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(null)
  const [error, setError] = useState(null)
  const [conflicts, setConflicts] = useState(null)

  // Nothing saved yet: start on every connected client, once the list arrives.
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
      onSaved?.(await patchAgent(agent.id, { client_caps: next }))
    } catch (err) {
      setError(`Couldn't save that pause limit: ${err.message}`)
    }
  }

  // `claims` is {move_claims} or {only_flag} when answering a conflict.
  const save = async (claims = {}) => {
    if (selected.length === 0) {
      setError("Pick at least one client for it to watch.")
      return
    }
    setSaving(true)
    setError(null)
    setConflicts(null)
    try {
      const updated = await patchAgent(agent.id, { scope: { client_group_ids: selected }, ...claims })
      onSaved?.(updated)
      const text = picked(selected.length)
      setSaved(text)
      onSend(text)
    } catch (err) {
      if (err?.status === 409 && err.conflicts?.length) setConflicts(err.conflicts)
      else setError(`Couldn't save: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div data-slot="setup-clients" className="flex flex-col gap-3">
      {clientsLoading ? (
        <Skeleton className="h-48 w-full rounded-frame" />
      ) : (
        <ClientScopeTable
          agentId={agent.id}
          clients={clients}
          selected={selected}
          onSelectedChange={setSelected}
          caps={caps}
          onCapChange={onCapChange}
          globalCap={agent?.guardrails?.max_pauses_per_client_day ?? 3}
        />
      )}
      {error && <Notice tone="danger">{error}</Notice>}
      {conflicts && (
        <ClaimConflicts
          conflicts={conflicts}
          clients={clients}
          busy={saving}
          onMove={() => save(moveClaims(flagOnly))}
          onOnlyFlag={(gid) => {
            const all = flagOnly.includes(gid) ? flagOnly : [...flagOnly, gid]
            setFlagOnly(all)
            save({ only_flag: all })
          }}
        />
      )}
      <BlockFooter
        saved={Boolean(saved)}
        savedLabel={saved}
        active={active}
        saving={saving}
        onSave={() => save()}
        label={`Watch ${selected.length} ${selected.length === 1 ? "client" : "clients"}`}
      />
    </div>
  )
}
