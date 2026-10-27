"use client"

import { Slack, Globe } from "lucide-react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import BirdyAvatar from "@/components/birdy/BirdyAvatar"
import MessageBubble from "@/components/chat/MessageBubble"
import { useConversation } from "@/lib/admin-api"

/**
 * Read-only view of one archived Birdy AI conversation (web or Slack),
 * reusing the product's own MessageBubble so admins see exactly what the user
 * saw. Powers pointer #2 (review users' conversations for analysis).
 */
const NOOP = () => {}
const EMPTY = new Set()

function ThreadSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Skeleton className="h-10 w-3/5 rounded-xl" /></div>
      <div className="flex justify-start"><Skeleton className="h-20 w-4/5 rounded-xl" /></div>
      <div className="flex justify-end"><Skeleton className="h-8 w-2/5 rounded-xl" /></div>
      <div className="flex justify-start"><Skeleton className="h-16 w-3/4 rounded-xl" /></div>
    </div>
  )
}

export default function ConversationViewer({ sessionId, onClose }) {
  const { data, isLoading } = useConversation(sessionId)
  const open = !!sessionId

  const source = data?.source
  const SourceIcon = source === "slack" ? Slack : Globe

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="bg-pd-surface max-w-2xl p-0 gap-0 overflow-hidden rounded-xl">
        <DialogHeader className="px-5 py-3.5 border-b border-pd-divider">
          <DialogTitle className="font-pd-display flex items-center gap-2 text-base">
            <BirdyAvatar size={28} />
            <span className="flex flex-col">
              <span className="leading-tight">{data?.owner || "Conversation"}</span>
              {data?.email && <span className="text-xs font-normal text-pd-subtle leading-tight">{data.email}</span>}
            </span>
            {source && (
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-pd-divider px-2 py-0.5 text-[11px] font-bold text-pd-body">
                <SourceIcon className="h-3 w-3" /> {source === "slack" ? "Slack" : "Birdy web"}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-4 bg-pd-canvas">
          {isLoading && <ThreadSkeleton />}
          {!isLoading && (data?.messages || [])
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m, i) => (
              <MessageBubble
                key={i}
                message={m}
                messageIndex={i}
                onUISubmit={NOOP}
                submittedUIs={EMPTY}
              />
            ))}
          {!isLoading && (data?.messages || []).length === 0 && (
            <p className="text-center text-sm text-pd-subtle py-12">This conversation has no messages.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
