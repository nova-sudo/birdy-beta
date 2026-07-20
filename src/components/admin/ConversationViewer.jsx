"use client"

import { Bird, Slack, Globe, Loader2 } from "lucide-react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import MessageBubble from "@/components/chat/MessageBubble"
import { useConversation } from "@/lib/admin-api"

/**
 * Read-only view of one archived Birdy AI conversation (web or Slack),
 * reusing the product's own MessageBubble so admins see exactly what the user
 * saw. Powers pointer #2 (review users' conversations for analysis).
 */
const NOOP = () => {}
const EMPTY = new Set()

export default function ConversationViewer({ sessionId, onClose }) {
  const { data, isLoading } = useConversation(sessionId)
  const open = !!sessionId

  const source = data?.source
  const SourceIcon = source === "slack" ? Slack : Globe

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="bg-white max-w-2xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-3.5 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="h-7 w-7 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <Bird className="h-3.5 w-3.5 text-white" />
            </span>
            <span className="flex flex-col">
              <span className="leading-tight">{data?.owner || "Conversation"}</span>
              {data?.email && <span className="text-xs font-normal text-muted-foreground leading-tight">{data.email}</span>}
            </span>
            {source && (
              <span className="ml-auto inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
                <SourceIcon className="h-3 w-3" /> {source === "slack" ? "Slack" : "Birdy web"}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-4 bg-[#FAFAFA]">
          {isLoading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
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
            <p className="text-center text-sm text-muted-foreground py-12">This conversation has no messages.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
