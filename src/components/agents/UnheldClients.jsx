"use client"

import { useState } from "react"

import { Button, Notice } from "@/components/ds"
import { patchAgent, useAgentClaims } from "@/lib/agents-api"

/**
 * Clients this agent watches that no agent acts on, say after one moved to the stock agent and it was
 * turned off. Nothing hands them back by itself, so each gets a button that does. A client another
 * agent holds isn't shown: moving it away is a choice made in setup.
 */
export function UnheldClients({ agent, onSaved }) {
  const { clients, mutate } = useAgentClaims(agent.id)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const unheld = clients.filter((c) => c.acting === "no_agent")

  const takeBack = async (gid) => {
    setBusy(gid)
    setError(null)
    // A scope save claims every client outside only_flag and refuses them all if any is held elsewhere,
    // so those stay only flag, and so do the ones already chosen, apart from the one taken back.
    const chosen = agent.scope?.flag_only_client_group_ids ?? []
    const only_flag = clients
      .filter((c) => c.client_group_id !== gid && (c.acting === "other_agent" || chosen.includes(c.client_group_id)))
      .map((c) => c.client_group_id)
    try {
      const updated = await patchAgent(agent.id, {
        scope: { client_group_ids: clients.map((c) => c.client_group_id) },
        only_flag,
      })
      onSaved(updated)
    } catch (err) {
      setError(err?.status === 409 ? "Another agent has just taken this client, so nothing changed." : `Couldn't take it back: ${err?.message}`)
    }
    await mutate()
    setBusy(null)
  }

  if (unheld.length === 0 && !error) return null
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {error && <Notice tone="danger">{error}</Notice>}
      {unheld.map((c) => (
        <Notice
          key={c.client_group_id}
          tone="warning"
          title={`No agent is acting on ${c.name}`}
          action={
            <Button size="sm" variant="outline" loading={busy === c.client_group_id} disabled={busy !== null} onClick={() => takeBack(c.client_group_id)}>
              Take back {c.name}
            </Button>
          }
        >
          This agent only flags it, so nothing changes in Meta. Take it back and this agent can act on it again from its next check.
        </Notice>
      ))}
    </div>
  )
}
