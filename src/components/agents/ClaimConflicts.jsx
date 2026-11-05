"use client"

import { Button, Notice } from "@/components/ds"

/**
 * Clients another agent already watches, from a 409 on save or turn-on.
 * Move takes every one of them over in a single action; Only flag is per client
 * and keeps watching it without acting on it.
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
              <span className="font-medium">{nameOf(c.client_group_id)}</span> is with{" "}
              {c.holder_name || "another agent"}
            </span>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onOnlyFlag(c.client_group_id)}>
              Only flag
            </Button>
          </li>
        ))}
      </ul>
      <Button size="sm" variant="outline" className="mt-3" disabled={busy} onClick={onMove}>
        {conflicts.length === 1 ? "Move it here" : "Move all here"}
      </Button>
    </Notice>
  )
}
