"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { RotateCcw } from "lucide-react"
import { Button, confirm, toast } from "@/components/ds"
import { deleteAgent, useAgents } from "@/lib/agents-api"

const NEW_HREF = "/hub/agents/custom/new"
const CUSTOM_WARNING =
  "This deletes the clients you picked, the training chat, your practice answers and any playbook changes. You can't undo it."

/**
 * Throws away a draft agent (its clients, training, practice answers and playbook edits)
 * and opens the new-agent page so it can be started again. `redirectTo={null}` stays on the page; `description` is the warning text.
 */
export function StartOverButton({ agent, variant = "ghost", size, className, redirectTo = NEW_HREF, description = CUSTOM_WARNING }) {
  const router = useRouter()
  const { mutate: mutateAgents } = useAgents()
  const [busy, setBusy] = useState(false)

  const startOver = async () => {
    const ok = await confirm({
      title: "Start setup over?",
      description,
      confirmLabel: "Start over",
    })
    if (!ok) return
    setBusy(true)
    try {
      await deleteAgent(agent.id)
      await mutateAgents((list) => (Array.isArray(list) ? list.filter((a) => a.id !== agent.id) : []), {
        revalidate: false,
      })
      if (redirectTo) router.push(redirectTo)
    } catch (err) {
      toast.error("Couldn't start over", {
        description: err?.status === 409 ? "This agent is already switched on." : err?.message,
      })
      setBusy(false)
    }
  }

  return (
    <Button variant={variant} size={size} className={className} loading={busy} onClick={startOver}>
      <RotateCcw aria-hidden />
      Start over
    </Button>
  )
}
