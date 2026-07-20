"use client"

import { formatDistanceToNow } from "date-fns"
import { Slack, Globe, Loader2, ChevronRight } from "lucide-react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { useUserConversations } from "@/lib/admin-api"

function relative(ts) {
  if (!ts) return ""
  try { return formatDistanceToNow(new Date(ts), { addSuffix: true }) } catch { return "" }
}

/**
 * Session picker for one agency owner — lists their archived Birdy AI
 * conversations (web + Slack). Selecting one opens the ConversationViewer.
 */
export default function UserConversationsDialog({ agency, onOpenSession, onClose }) {
  const email = agency?.email
  const { data, isLoading } = useUserConversations(email)
  const sessions = data?.sessions || []

  return (
    <Dialog open={!!agency} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="bg-white max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-3.5 border-b">
          <DialogTitle className="text-base">
            Conversations · <span className="text-purple-600">{agency?.owner}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[65vh] overflow-y-auto p-2">
          {isLoading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
          {!isLoading && sessions.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-12">
              No conversations recorded for this account yet.
            </p>
          )}
          {sessions.map((s) => {
            const SourceIcon = s.source === "slack" ? Slack : Globe
            return (
              <button
                key={s.session_id}
                onClick={() => onOpenSession?.(s.session_id)}
                className="w-full text-left flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors"
              >
                <div className="h-8 w-8 shrink-0 rounded-lg bg-purple-50 flex items-center justify-center">
                  <SourceIcon className="h-4 w-4 text-purple-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-purple-600">{s.category_label}</span>
                    <span className="text-[10px] text-muted-foreground">· {s.message_count} messages</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">{relative(s.last_at)}</span>
                  </div>
                  <p className="text-sm text-gray-700 truncate mt-0.5">{s.preview || "—"}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
