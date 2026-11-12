"use client"

import { useState } from "react"
import { Lock } from "lucide-react"

import { Notice } from "@/components/ds"
import { GuardrailsForm } from "@/components/agents/GuardrailsForm"
import { patchAgent } from "@/lib/agents-api"
import { BlockFooter } from "./BlockFooter"

export const PERMISSIONS_SAVED = "Saved what it can change"

/** What the agent may touch in Meta and its hard limits: a GuardrailsForm, saved through patchAgent. */
export function PermissionsBlock({ agent, active, onSend, onSaved }) {
  const [permissions, setPermissions] = useState(() => agent?.permissions ?? {})
  const [guardrails, setGuardrails] = useState(() => agent?.guardrails ?? {})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      onSaved?.(await patchAgent(agent.id, { permissions, guardrails }))
      setSaved(true)
      onSend(PERMISSIONS_SAVED)
    } catch (err) {
      setError(`Couldn't save: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div data-slot="setup-permissions" className="flex flex-col gap-3">
      <GuardrailsForm
        permissions={permissions}
        guardrails={guardrails}
        onChange={(patch) => {
          if (patch.permissions) setPermissions((p) => ({ ...p, ...patch.permissions }))
          if (patch.guardrails) setGuardrails((g) => ({ ...g, ...patch.guardrails }))
        }}
      />
      <Notice tone="neutral" icon={Lock}>
        Every rule starts on <span className="font-medium">Ask me</span>. Nothing changes in your ad accounts until you approve it.
      </Notice>
      {error && <Notice tone="danger">{error}</Notice>}
      <BlockFooter saved={saved} savedLabel={PERMISSIONS_SAVED} active={active} saving={saving} onSave={save} label="Save" />
    </div>
  )
}
