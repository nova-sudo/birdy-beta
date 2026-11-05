"use client"

// components/clients/ClientNameCard.jsx
// The first card on the Details tab of the Client Detail settings modal.

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiRequest } from "@/lib/api"

// The API refuses anything longer; see services/client_rename.py.
const MAX_NAME_LENGTH = 100

/**
 * @param {object} props
 * @param {string} props.clientId
 * @param {string} [props.name] The saved name; undefined while the client loads
 * @param {(name: string) => void} [props.onRenamed]
 */
export function ClientNameCard({ clientId, name, onRenamed }) {
  const [draft, setDraft] = useState(name ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    setDraft(name ?? "")
    setError("")
  }, [name])

  const trimmed = draft.trim()
  const changed = trimmed !== "" && trimmed !== name

  const handleChange = (e) => {
    setDraft(e.target.value)
    setError(e.target.value.trim() ? "" : "Enter a client name.")
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!changed || saving) return
    setSaving(true)
    setError("")
    try {
      const res = await apiRequest(`/api/client-groups/${encodeURIComponent(clientId)}/name`, {
        method: "PATCH",
        body: JSON.stringify({ name: trimmed }),
      })
      if (res.status === 400) {
        const body = await res.json().catch(() => ({}))
        setError(body.detail || "That name can't be saved.")
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      toast.success(`Client renamed to ${data.name}`)
      onRenamed?.(data.name)
    } catch {
      toast.error("Couldn't rename this client. Try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <Label htmlFor="client-name" className="text-sm font-semibold text-pd-ink">
            Client name
          </Label>
          <p className="text-xs text-pd-subtle">
            Shown across Birdy, in reports and in Slack messages.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input
              id="client-name"
              value={draft}
              onChange={handleChange}
              maxLength={MAX_NAME_LENGTH}
              disabled={name === undefined}
              aria-invalid={!!error}
              aria-describedby={error ? "client-name-error" : undefined}
              className="min-w-0 flex-1"
            />
            <Button type="submit" disabled={!changed || saving} className="shrink-0">
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
          {error && (
            <p id="client-name-error" role="alert" className="mt-1.5 text-xs text-pd-danger">
              {error}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
