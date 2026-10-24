"use client"

import { formatDistanceToNow } from "date-fns"
import { Slack, Globe, ChevronRight } from "lucide-react"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Skeleton,
} from "@/components/ds"
import { Stagger, StaggerItem } from "@/components/motion"
import { useUserConversations } from "@/lib/admin-api"

function relative(ts) {
  if (!ts) return ""
  try { return formatDistanceToNow(new Date(ts), { addSuffix: true }) } catch { return "" }
}

function ListSkeleton() {
  return (
    <div className="space-y-1">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
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
      <DialogContent className="gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border py-3.5 pl-5 pr-14">
          <DialogDescription className="sr-only">Archived Birdy AI conversations for this account.</DialogDescription>
          <DialogTitle className="text-base">
            Conversations · <span className="text-primary">{agency?.owner}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[65vh] overflow-y-auto p-2">
          {isLoading && <ListSkeleton />}
          {!isLoading && sessions.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No conversations recorded for this account yet.
            </p>
          )}
          <Stagger gap={0.04}>
            {sessions.map((s) => {
              const SourceIcon = s.source === "slack" ? Slack : Globe
              return (
                <StaggerItem key={s.session_id}>
                  <button
                    onClick={() => onOpenSession?.(s.session_id)}
                    className="flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left outline-none transition-colors hover:bg-muted focus-visible:shadow-control-focus"
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft">
                      <SourceIcon aria-hidden className="size-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-primary">{s.category_label}</span>
                        <span className="text-xs text-muted-foreground">· {s.message_count} messages</span>
                        <span className="ml-auto text-xs text-muted-foreground">{relative(s.last_at)}</span>
                      </div>
                      <p className="mt-0.5 truncate text-sm text-body">{s.preview || "—"}</p>
                    </div>
                    <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                </StaggerItem>
              )
            })}
          </Stagger>
        </div>
      </DialogContent>
    </Dialog>
  )
}
