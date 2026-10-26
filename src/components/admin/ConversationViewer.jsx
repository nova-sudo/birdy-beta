"use client"

import { Slack, Globe } from "lucide-react"
import {
  Badge, Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle, Skeleton,
} from "@/components/ds"
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
      <div className="flex justify-end"><Skeleton className="h-10 w-3/5 rounded-surface" /></div>
      <div className="flex justify-start"><Skeleton className="h-20 w-4/5 rounded-surface" /></div>
      <div className="flex justify-end"><Skeleton className="h-8 w-2/5 rounded-surface" /></div>
      <div className="flex justify-start"><Skeleton className="h-16 w-3/4 rounded-surface" /></div>
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
      <DialogContent size="lg">
        {/* The header strip's pr-14 keeps the source badge clear of the dialog's close button. */}
        <DialogHeader>
          <DialogDescription className="sr-only">Read-only transcript of this conversation.</DialogDescription>
          <DialogTitle className="flex items-center gap-2 text-base">
            <BirdyAvatar size={28} />
            <span className="flex flex-col">
              <span className="leading-tight">{data?.owner || "Conversation"}</span>
              {data?.email && <span className="text-xs font-normal leading-tight text-muted-foreground">{data.email}</span>}
            </span>
            {source && (
              <Badge className="ml-auto">
                <SourceIcon aria-hidden /> {source === "slack" ? "Slack" : "Birdy web"}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Muted under the bubbles so a white assistant bubble still reads as one. */}
        <DialogBody className="bg-muted">
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
            <p className="py-12 text-center text-sm text-muted-foreground">This conversation has no messages.</p>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
