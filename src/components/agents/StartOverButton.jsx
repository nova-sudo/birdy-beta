"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { RotateCcw } from "lucide-react"
import { Button, confirm, toast } from "@/components/ds"
import { deleteAgent, useAgents } from "@/lib/agents-api"

const SETUP_HREF = "/hub/agents/media-buying/setup"

/**
 * Throws away a draft agent (its clients, training, practice answers and playbook edits)
 * and opens setup from step 1 with a fresh one.
 */
export function StartOverButton({ agent, variant = "ghost", size, className }) {
  const router = useRouter()
  const { mutate: mutateAgents } = useAgents()
  const [busy, setBusy] = useState(false)

  const startOver = async () => {
    const ok = await confirm({
      title: "Start setup over?",
      description:
        "This deletes the clients you picked, the training chat, your practice answers and any playbook changes. You can't undo it.",
      confirmLabel: "Start over",
    })
    if (!ok) return
    setBusy(true)
    try {
      await deleteAgent(agent.id)
      await mutateAgents((list) => (Array.isArray(list) ? list.filter((a) => a.id !== agent.id) : []), {
        revalidate: false,
      })
      router.push(`${SETUP_HREF}?step=1`)
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
