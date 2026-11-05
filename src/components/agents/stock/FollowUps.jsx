"use client"

import { Check, HelpCircle, X } from "lucide-react"

import { Frame } from "@/components/ds"

function Tick({ ok }) {
  if (ok === true) return <Check aria-label="Done" className="mt-0.5 size-4 shrink-0 text-success" />
  if (ok === false) return <X aria-label="Not done" className="mt-0.5 size-4 shrink-0 text-danger" />
  return <HelpCircle aria-label="Check by hand" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
}

/** Whether last round's changes really happened, client by client. */
export function FollowUps({ items, nameOf }) {
  const clients = [...new Set(items.map((f) => f.client_group_id))]
  return (
    <Frame title="Follow-ups from last round" padded contentClassName="flex flex-col gap-3 text-xs">
      {clients.map((gid) => (
        <div key={gid} className="flex flex-col gap-1.5">
          <div className="font-semibold">{nameOf(gid)}</div>
          {items
            .filter((f) => f.client_group_id === gid)
            .map((f) => (
              <div key={f.line_id} className="flex items-start gap-1.5">
                <Tick ok={f.ok} />
                <span className="min-w-0 [overflow-wrap:anywhere]">{f.text}</span>
              </div>
            ))}
        </div>
      ))}
    </Frame>
  )
}
