"use client"

import { useState } from "react"

import { Button, Notice, ProgressBar } from "@/components/ds"

const plural = (n) => (n === 1 ? "1 client" : `${n} clients`)

/**
 * Where the Meta ad history sync stands, for the Practice round.
 * Nothing once every client is ready and none is unreadable.
 *
 * @param {object} props
 * @param {{total: number, ready: number, clients: object[]}} [props.history]
 */
export function HistoryProgress({ history }) {
  const [open, setOpen] = useState(false)
  if (!history) return null

  const { total, ready } = history
  const errored = (history.clients ?? []).filter((c) => c.status === "error")
  const noToken = errored.filter((c) => c.error === "no_token")
  const noAccess = errored.filter((c) => c.error !== "no_token")
  const syncing = ready < total - errored.length

  if (!syncing && errored.length === 0) return null

  return (
    <div className="flex flex-col gap-2 p-3">
      {syncing && (
        <Notice tone="info" title="Getting your ad history from Meta">
          <p>{ready} of {total} clients ready. Cases appear as each one finishes.</p>
          <ProgressBar
            tone="primary"
            label="Ad history ready"
            value={total ? (ready / total) * 100 : 0}
            className="mt-2"
          />
        </Notice>
      )}
      {errored.length > 0 && (
        <div className="text-sm text-muted-foreground">
          {noAccess.length > 0 && (
            <p>
              {plural(noAccess.length)} can&apos;t be read: Meta hasn&apos;t given access to their ad accounts.
            </p>
          )}
          {noToken.length > 0 && (
            <p>
              {plural(noToken.length)} can&apos;t be read: Reconnect Meta in Settings.
            </p>
          )}
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            See which
          </Button>
          {open && (
            <ul className="mt-1 list-disc pl-5">
              {errored.map((c) => (
                <li key={c.client_group_id}>{c.name}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
