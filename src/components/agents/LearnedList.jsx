"use client"

import * as React from "react"
import { Brain, MessageSquareText, ShieldCheck } from "lucide-react"

import { Button, ErrorState, Frame, Skeleton, toast } from "@/components/ds"
import { deleteMemory, useAgentMemory } from "@/lib/agents-api"
import { cn } from "@/lib/utils"

const SOURCES = {
  denial: "From a denial note",
  chat: "From training chat",
  note: "From a note",
}

/** "24 Oct" from the API's naive-UTC timestamp. */
function shortDate(iso) {
  if (!iso) return null
  const s = String(iso)
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
}

export function sourceLine(item) {
  return [SOURCES[item.source] ?? "From setup", shortDate(item.created_at)].filter(Boolean).join(" · ")
}

/**
 * What the agent has learned: each remembered fact or exception with where it came from, and
 * Remove. Removing drops it at once, then deletes it on the server (it comes back on failure).
 *
 * @param {object} props
 * @param {string} props.agentId
 */
export function LearnedList({ agentId, className }) {
  const { memory, error, isLoading, mutate } = useAgentMemory(agentId)

  const remove = async (item) => {
    mutate((cur) => (Array.isArray(cur) ? cur.filter((m) => m.id !== item.id) : cur), { revalidate: false })
    try {
      await deleteMemory(agentId, item.id)
      toast("Birdy forgot that", { description: item.text })
    } catch (err) {
      toast.error("Couldn't remove that", { description: err.message })
    } finally {
      mutate()
    }
  }

  return (
    <Frame
      title="What it has learned"
      leading={<Brain aria-hidden className="size-4 text-primary" />}
      action={
        memory.length > 0 ? (
          <span className="text-xs text-muted-foreground">
            {memory.length} {memory.length === 1 ? "item" : "items"}
          </span>
        ) : undefined
      }
      className={cn("min-w-0", className)}
    >
      {error ? (
        <ErrorState className="p-4" title="Couldn't load what it has learned" onRetry={() => mutate()} />
      ) : isLoading ? (
        <Skeleton className="m-4 h-24 rounded-control" />
      ) : memory.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">
          Nothing yet. Notes you add when you deny something, and facts from the training chat, show here.
        </p>
      ) : (
        <ul className="divide-y divide-divider">
          {memory.map((item) => {
            const Icon = item.kind === "exception" ? ShieldCheck : MessageSquareText
            return (
              <li key={item.id} className="flex items-start gap-3 px-4 py-3">
                <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{item.text}</p>
                  <p className="text-xs text-muted-foreground">{sourceLine(item)}</p>
                </div>
                <Button variant="ghost" size="sm" aria-label={`Remove “${item.text}”`} onClick={() => remove(item)}>
                  Remove
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </Frame>
  )
}
