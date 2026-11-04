"use client"

import { useState } from "react"
import { useSWRConfig } from "swr"
import { Zap } from "lucide-react"

import { Button, Notice } from "@/components/ds"
import { ClaimConflicts } from "@/components/agents/ClaimConflicts"
import { activateAgent, useAgents } from "@/lib/agents-api"
import { revalidateStock } from "@/lib/stock-agent-api"

/**
 * Turns a turned-off stock agent back on. It calls `activate` directly: the finished preview is still on file,
 * so setup isn't needed. If the server says something is missing, lists it; if another agent now holds a
 * client, offers Move here or Only flag.
 *
 * @param {object} props
 * @param {{id: string, scope?: object}} props.agent
 * @param {{id: string, name: string}[]} [props.clients] Names for the conflict list; without them it says "This client"
 * @param {string} [props.variant]
 * @param {string} [props.size]
 */
export function TurnOn({ agent, clients = [], variant = "primary", size, className }) {
  const { mutate } = useSWRConfig()
  const { mutate: mutateAgents } = useAgents()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [missing, setMissing] = useState([])
  const [conflicts, setConflicts] = useState(null)
  const flagOnly = agent.scope?.flag_only_client_group_ids ?? []

  const turnOn = async (claims = {}) => {
    setBusy(true)
    setError(null)
    setMissing([])
    setConflicts(null)
    try {
      await activateAgent(agent.id, { only_flag: claims.only_flag ?? flagOnly, ...(claims.move_claims ? { move_claims: true } : {}) })
      await Promise.all([revalidateStock(mutate, agent.id), mutateAgents()])
    } catch (err) {
      if (err?.status === 409 && err.conflicts?.length) setConflicts(err.conflicts)
      else if (err?.status === 409 && err.missing?.length) {
        setMissing(err.missing)
        setError("It isn't ready to turn on yet. Still needed:")
      } else setError(err?.message || "Couldn't turn it on. Try again in a moment.")
    }
    setBusy(false)
  }

  return (
    <div className="flex flex-col gap-3">
      <Button variant={variant} size={size} className={className} loading={busy} onClick={() => turnOn()}>
        <Zap aria-hidden />
        Turn on
      </Button>
      {error && (
        <Notice tone="warning">
          <p>{error}</p>
          {missing.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
        </Notice>
      )}
      {conflicts && (
        <ClaimConflicts
          conflicts={conflicts}
          clients={clients}
          busy={busy}
          onMove={() => turnOn({ move_claims: true })}
          onOnlyFlag={(gid) => turnOn({ only_flag: flagOnly.includes(gid) ? flagOnly : [...flagOnly, gid] })}
        />
      )}
    </div>
  )
}
