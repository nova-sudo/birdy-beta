"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight } from "lucide-react"

import { usePageHeader } from "@/components/page-header"
import { SalesHubHeaderTitle } from "@/components/hub/HubShell"
import { Button, Input, Label, PageHeader } from "@/components/ds"
import { createAgent, customSetupPath, useAgents } from "@/lib/agents-api"

const MAX_NAME = 60

/** Names a new custom agent, then opens its setup. */
export default function NewCustomAgentPage() {
  const router = useRouter()
  const { mutate: mutateAgents } = useAgents()
  const [name, setName] = useState("")
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const topBar = useMemo(() => ({ title: <SalesHubHeaderTitle title="New agent" subtitle="BirdyHub" /> }), [])
  usePageHeader(topBar)

  const submit = async (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError("Give the agent a name.")
      return
    }
    if (trimmed.length > MAX_NAME) {
      setError(`Keep the name to ${MAX_NAME} characters or fewer.`)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const agent = await createAgent({ type: "custom", name: trimmed })
      mutateAgents()
      router.push(customSetupPath(agent.id))
    } catch (err) {
      setError(err?.message || "Couldn't create the agent. Try again in a moment.")
      setSaving(false)
    }
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6 font-sans">
      <PageHeader
        backButton={{ label: "BirdyHub", href: "/hub" }}
        title="Create your own agent"
        description="Name it after the job it does. You choose what it watches and teach it your rules next."
      />
      <form onSubmit={submit} noValidate className="flex max-w-md flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="agent-name">Agent name</Label>
          <Input
            id="agent-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Pause and revive rules"
            autoFocus
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "agent-name-error" : undefined}
          />
          {error && (
            <p id="agent-name-error" role="alert" className="text-xs text-danger-ink">
              {error}
            </p>
          )}
        </div>
        <div>
          <Button type="submit" variant="primary" size="lg" loading={saving}>
            Create agent
            <ArrowRight aria-hidden />
          </Button>
        </div>
      </form>
    </div>
  )
}
