"use client"

import { Button, Notice } from "@/components/ds"

/**
 * Clients another agent already watches, from a 409 on save or turn-on.
 * Each row can take the client over (Move it here) or keep watching it
 * without acting on it (Only flag).
 * `conflicts` is `[{client_group_id, holder_id, holder_name}]`.
 */
export function ClaimConflicts({ conflicts, clients, busy = false, onMove, onOnlyFlag }) {
  const nameOf = (gid) => clients.find((c) => c.id === gid)?.name ?? "This client"
  return (
    <Notice tone="warning" title="Another agent already watches some of these clients">
      <ul className="mt-2 flex flex-col gap-2">
        {conflicts.map((c) => (
          <li key={c.client_group_id} className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm">
              <span className="font-medium">{nameOf(c.client_group_id)}</span> is with {c.holder_name}
            </span>
            <span className="flex gap-2">
              <Button size="sm" variant="outline" disabled={busy} onClick={onMove}>
                Move it here
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => onOnlyFlag(c.client_group_id)}>
                Only flag
              </Button>
            </span>
          </li>
        ))}
      </ul>
    </Notice>
  )
}
