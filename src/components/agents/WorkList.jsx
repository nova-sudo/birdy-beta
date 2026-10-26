"use client"

import { useCallback, useMemo, useState } from "react"
import { useSWRConfig } from "swr"

import { BirdyRead, ErrorState, Skeleton } from "@/components/ds"
import { revalidateAgentWork, useAgentWork } from "@/lib/agents-api"
import { cn } from "@/lib/utils"
import { AutoRunToday } from "./AutoRunToday"
import { WorkItem } from "./WorkItem"

/**
 * The agent's daily work list: "Needs you" (open items to approve, deny or
 * acknowledge) beside what it did on auto-run today.
 *
 * Decided items stay on screen, marked, until the page is left; the list and
 * the nav badge are re-read after every decision.
 *
 * @param {object} props
 * @param {string} props.agentId
 * @param {React.ReactNode} [props.empty] Shown when nothing needs the user
 */
export function WorkList({ agentId, empty, className }) {
  const { work, error, isLoading, mutate } = useAgentWork(agentId)
  const { mutate: mutateCache } = useSWRConfig()
  // id → {item, decision, index}: decided this visit, kept in place after the server drops them.
  const [settled, setSettled] = useState(() => new Map())

  const open = useMemo(() => (Array.isArray(work.open) ? work.open : []), [work.open])
  const auto = Array.isArray(work.auto_applied) ? work.auto_applied : []

  const onDecided = useCallback(
    (item, decision) => {
      setSettled((prev) => {
        const next = new Map(prev)
        const index = open.findIndex((i) => i.id === item.id)
        next.set(item.id, { item, decision, index: index < 0 ? open.length : index })
        return next
      })
      // Drop it from the cached list at once (the badge reads the same entry), then re-read.
      mutate((cur) => (cur ? { ...cur, open: (cur.open ?? []).filter((i) => i.id !== item.id) } : cur), {
        revalidate: false,
      })
      revalidateAgentWork(mutateCache)
    },
    [open, mutate, mutateCache]
  )

  const onUndone = useCallback(() => revalidateAgentWork(mutateCache), [mutateCache])

  const rows = useMemo(() => {
    const list = open.map((item) => ({ item, decision: settled.get(item.id)?.decision ?? null }))
    const gone = [...settled.values()]
      .filter((s) => !open.some((i) => i.id === s.item.id))
      .sort((a, b) => a.index - b.index)
    for (const s of gone) list.splice(Math.min(s.index, list.length), 0, { item: s.item, decision: s.decision })
    return list
  }, [open, settled])

  const pending = open.filter((i) => !settled.has(i.id)).length

  if (error && !work.open?.length) {
    return <ErrorState title="Couldn't load the work list" onRetry={() => mutate()} />
  }
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Skeleton className="h-72 w-full rounded-frame" />
        <Skeleton className="h-40 w-full rounded-frame" />
      </div>
    )
  }

  return (
    <div className={cn("grid grid-cols-1 items-start gap-6", auto.length > 0 && "lg:grid-cols-[1.6fr_1fr]", className)}>
      <BirdyRead title="Needs you" count={pending} empty={empty} className="min-w-0">
        {rows.length > 0 && (
          <ul className="divide-y divide-divider">
            {rows.map(({ item, decision }) => (
              <li key={item.id}>
                <WorkItem item={item} decided={decision} onDecided={onDecided} />
              </li>
            ))}
          </ul>
        )}
      </BirdyRead>
      {auto.length > 0 && <AutoRunToday items={auto} onUndone={onUndone} className="min-w-0" />}
    </div>
  )
}
