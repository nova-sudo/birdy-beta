"use client"

// components/clients/ClientAskBirdy.jsx
// The Ask Birdy tab on Client Detail — the design's two panes: a 260px thread
// rail on the left, the chat card on the right.
//
// Threads are scoped to this client. The conversation log records which client
// a thread was opened from, so the rail shows only conversations about this
// one; asking about Aura should never surface what you asked about a different
// client. Conversations logged before that field existed carry no client and
// so do not appear here — they are still on /ask-birdy.

import { useCallback, useEffect, useState } from "react"
import { MessageSquarePlus } from "lucide-react"
import { toast } from "sonner"
import { apiRequest } from "@/lib/api"
import { Button, Skeleton, Surface } from "@/components/ds"
import { cn } from "@/lib/utils"
import BirdyChat from "@/components/chat/BirdyChat"

export function ClientAskBirdy({ clientId, clientName, initialMessage }) {
  const [threads, setThreads] = useState([])
  const [loadingThreads, setLoadingThreads] = useState(true)
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [opening, setOpening] = useState(false)
  // Remounts the chat card, which is what actually resets it between threads.
  const [resetKey, setResetKey] = useState(0)

  const loadThreads = useCallback(async () => {
    if (!clientId) return
    try {
      const res = await apiRequest(
        `/api/chat/conversations?client_group_id=${encodeURIComponent(clientId)}`
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setThreads(data.conversations || [])
    } catch (err) {
      console.warn("[client] Could not load conversations:", err)
    } finally {
      setLoadingThreads(false)
    }
  }, [clientId])

  useEffect(() => { loadThreads() }, [loadThreads])

  const startNew = () => {
    setActiveSessionId(null)
    setMessages([])
    setResetKey((k) => k + 1)
  }

  const openThread = async (thread) => {
    if (thread.session_id === activeSessionId) return
    setOpening(true)
    try {
      const res = await apiRequest(
        `/api/chat/conversations/${encodeURIComponent(thread.session_id)}`
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setMessages(data.messages || [])
      setActiveSessionId(thread.session_id)
      setResetKey((k) => k + 1)
    } catch (err) {
      console.error("[client] Could not open conversation:", err)
      toast.error("Could not open that conversation")
    } finally {
      setOpening(false)
    }
  }

  // A new thread only learns its id from the first reply; adopt it so the next
  // message continues the same conversation instead of starting another.
  const handleSessionId = useCallback((sessionId) => {
    setActiveSessionId((prev) => prev ?? sessionId)
  }, [])

  const handleMessagesChange = useCallback((msgs) => {
    if (msgs.length > 0 && msgs[msgs.length - 1].role === "assistant") {
      loadThreads()
    }
  }, [loadThreads])

  return (
    // The design fixes this row's height and lets each pane scroll inside it,
    // so the composer stays put instead of walking down the page as a thread
    // grows. Stacked below lg, where a fixed height would trap the chat.
    <div className="flex flex-col gap-4 lg:h-[660px] lg:flex-row">
      {/* ── Thread rail ────────────────────────────────────────────── */}
      <Surface as="aside" className="flex shrink-0 flex-col lg:w-64">
        <Button variant="primary" onClick={startNew} className="w-full">
          <MessageSquarePlus />
          New conversation
        </Button>

        <p className="mb-2 mt-4 text-xs font-medium text-muted-foreground">
          Recent
        </p>

        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto max-lg:max-h-80">
          {loadingThreads ? (
            <div className="flex flex-col gap-1" aria-busy="true">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2 px-3 py-2.5">
                  <Skeleton className="h-3.5 w-4/5" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : threads.length === 0 ? (
            <p className="px-1 py-4 text-sm text-muted-foreground">
              No conversations about {clientName || "this client"} yet.
            </p>
          ) : (
            threads.map((thread) => (
              // The design marks the open thread with a tint alone — no border,
              // which would shift the text of every other row by a pixel.
              <button
                key={thread.session_id}
                onClick={() => openThread(thread)}
                disabled={opening}
                aria-current={activeSessionId === thread.session_id ? "true" : undefined}
                className={cn(
                  "w-full rounded-control px-3 py-2.5 text-left outline-none transition-colors focus-visible:shadow-control-focus disabled:opacity-60",
                  activeSessionId === thread.session_id ? "bg-primary-soft" : "hover:bg-muted"
                )}
              >
                <p
                  className={cn(
                    "truncate text-sm font-medium leading-snug",
                    activeSessionId === thread.session_id ? "text-primary" : "text-body"
                  )}
                >
                  {thread.title}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {thread.updated_at
                    ? new Date(thread.updated_at).toLocaleDateString()
                    : ""}
                  {thread.message_count ? ` · ${thread.message_count} messages` : ""}
                </p>
              </button>
            ))
          )}
        </div>
      </Surface>

      {/* ── Chat card ──────────────────────────────────────────────── */}
      <div className="min-w-0 flex-1">
        <BirdyChat
          key={resetKey}
          clientId={clientId}
          clientName={clientName}
          sessionId={activeSessionId}
          onSessionId={handleSessionId}
          initialMessages={messages}
          initialMessage={initialMessage}
          onMessagesChange={handleMessagesChange}
        />
      </div>
    </div>
  )
}
