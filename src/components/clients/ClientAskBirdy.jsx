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
import { MessageSquarePlus, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { apiRequest } from "@/lib/api"
import { Button } from "@/components/ui/button"
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
    <div className="flex flex-col gap-[18px] lg:flex-row">
      {/* ── Thread rail ────────────────────────────────────────────── */}
      <aside className="flex shrink-0 flex-col gap-3 lg:w-[260px]">
        <Button
          onClick={startNew}
          className="w-full gap-2 bg-[#6B4EE6] text-white hover:bg-[#5B3FD6]"
          size="sm"
        >
          <MessageSquarePlus className="size-3.5" />
          New conversation
        </Button>

        <p className="px-1 text-[10px] font-bold uppercase tracking-[.04em] text-pd-faint">
          Recent
        </p>

        <div className="max-h-[560px] space-y-1 overflow-y-auto">
          {loadingThreads ? (
            <p className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Loading…
            </p>
          ) : threads.length === 0 ? (
            <p className="px-1 py-4 text-xs text-muted-foreground">
              No conversations about {clientName || "this client"} yet.
            </p>
          ) : (
            threads.map((thread) => (
              <button
                key={thread.session_id}
                onClick={() => openThread(thread)}
                disabled={opening}
                aria-current={activeSessionId === thread.session_id ? "true" : undefined}
                className={`w-full rounded-[10px] border p-2.5 text-left transition disabled:opacity-60 ${
                  activeSessionId === thread.session_id
                    ? "border-[#6B4EE6] bg-[#F1EEFC]"
                    : "border-transparent hover:bg-pd-divider"
                }`}
              >
                <p className="truncate text-xs font-medium text-pd-ink">
                  {thread.title}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {thread.updated_at
                    ? new Date(thread.updated_at).toLocaleDateString()
                    : ""}
                  {thread.message_count ? ` · ${thread.message_count} messages` : ""}
                </p>
              </button>
            ))
          )}
        </div>
      </aside>

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
