"use client"

import { formatDistanceToNow } from "date-fns"
import { Slack, Globe, ChevronRight } from "lucide-react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
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
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3.5 w-full" />
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
      <DialogContent className="bg-pd-surface max-w-lg p-0 gap-0 overflow-hidden rounded-xl">
        <DialogHeader className="px-5 py-3.5 border-b border-pd-divider">
          <DialogTitle className="font-pd-display text-base">
            Conversations · <span className="text-pd-primary">{agency?.owner}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[65vh] overflow-y-auto p-2">
          {isLoading && <ListSkeleton />}
          {!isLoading && sessions.length === 0 && (
            <p className="text-center text-sm text-pd-subtle py-12">
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
                    className="w-full text-left flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-pd-table-head transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-ring/25"
                  >
                    <div className="h-8 w-8 shrink-0 rounded-full bg-pd-primary-tint flex items-center justify-center">
                      <SourceIcon className="h-4 w-4 text-pd-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-pd-primary">{s.category_label}</span>
                        <span className="text-[10px] text-pd-subtle">· {s.message_count} messages</span>
                        <span className="text-[10px] text-pd-subtle ml-auto">{relative(s.last_at)}</span>
                      </div>
                      <p className="text-sm text-pd-body truncate mt-0.5">{s.preview || "—"}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-pd-chevron shrink-0" />
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
