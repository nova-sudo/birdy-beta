"use client"
import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Bird, Sparkles, MessageSquarePlus, Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { apiRequest } from "@/lib/api"
import ChatConversation from "@/components/chat/ChatConversation"

// ── Suggestions shown on the empty sidebar tab ──────────────────────────
const SUGGESTIONS = [
  "Give me a summary of all my clients",
  "How many leads did I get this week?",
  "Compare this week to last week",
  "Which campaign has the best CTR?",
  "Show me my won opportunities and revenue",
  "Which ad has the most zombie leads?",
]

// History lives on the server, in the same append-only archive the Admin
// console reads. It used to be held in localStorage, which meant it was gone
// on any other machine — and the session id lived in sessionStorage, which
// dies with the tab, so reopening an old chat showed the transcript while the
// model had no memory of it. Both now come from the backend.
const NEW_CHAT = { id: "__new__", title: "New Conversation", sessionId: null }

export default function AskBirdyPage() {
  const [conversations, setConversations] = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const [active, setActive] = useState(NEW_CHAT)
  const [messages, setMessages] = useState([])
  const [loadingConvo, setLoadingConvo] = useState(false)
  const [pendingPrompt, setPendingPrompt] = useState(null)
  const [resetKey, setResetKey] = useState(0)
  const [pendingDelete, setPendingDelete] = useState(null)

  const loadConversations = useCallback(async () => {
    try {
      const res = await apiRequest("/api/chat/conversations")
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setConversations(data.conversations || [])
    } catch (err) {
      console.warn("[ask-birdy] Could not load conversations:", err)
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => { loadConversations() }, [loadConversations])

  const startNewConversation = (opts = {}) => {
    setActive(NEW_CHAT)
    setMessages([])
    setPendingPrompt(opts.prompt || null)
    setResetKey(k => k + 1)
  }

  const openConversation = async (convo) => {
    if (convo.session_id === active.sessionId) return
    setLoadingConvo(true)
    try {
      const res = await apiRequest(
        `/api/chat/conversations/${encodeURIComponent(convo.session_id)}`
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setMessages(data.messages || [])
      setActive({
        id: convo.session_id,
        title: convo.title,
        sessionId: convo.session_id,
      })
      setPendingPrompt(null)
      setResetKey(k => k + 1)
    } catch (err) {
      console.error("[ask-birdy] Could not open conversation:", err)
      toast.error("Could not open that conversation")
    } finally {
      setLoadingConvo(false)
    }
  }

  const deleteConversation = async (sessionId, e) => {
    e.stopPropagation()
    setPendingDelete(sessionId)
    try {
      const res = await apiRequest(
        `/api/chat/conversations/${encodeURIComponent(sessionId)}`,
        { method: "DELETE" }
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setConversations(prev => prev.filter(c => c.session_id !== sessionId))
      if (active.sessionId === sessionId) startNewConversation()
      toast.success("Conversation deleted")
    } catch (err) {
      console.error("[ask-birdy] Delete failed:", err)
      toast.error("Could not delete that conversation")
    } finally {
      setPendingDelete(null)
    }
  }

  // A new chat has no id until the first reply comes back. Adopt it so the
  // next message continues the same thread rather than starting another.
  const handleSessionId = useCallback((sessionId) => {
    setActive(prev => (prev.sessionId ? prev : { ...prev, sessionId }))
  }, [])

  // Titles and ordering are derived server-side, so refresh the list once a
  // turn completes rather than trying to mirror that logic here.
  const handleMessagesChange = useCallback((msgs) => {
    setMessages(msgs)
    if (msgs.length > 0 && msgs[msgs.length - 1].role === "assistant") {
      loadConversations()
    }
  }, [loadConversations])

  return (
    <div className="h-dvh w-full grid grid-cols-[280px_1fr] bg-background">
      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside className="border-r border-border/60 bg-white flex flex-col">
        <div className="p-4 border-b border-border/60">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white">
              <Bird className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-tight">Ask Birdy</h1>
              <p className="text-[10px] text-muted-foreground leading-tight">Your marketing co-pilot</p>
            </div>
          </div>
          <Button
            onClick={() => startNewConversation()}
            className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-white"
            size="sm"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            New Chat
          </Button>
        </div>

        <Tabs defaultValue="convos" className="flex-1 min-h-0 flex flex-col">
          <TabsList className="mx-3 mt-3 bg-muted/50">
            <TabsTrigger value="convos" className="flex-1 text-xs">Convos</TabsTrigger>
            <TabsTrigger value="suggested" className="flex-1 text-xs">
              <Sparkles className="h-3 w-3 mr-1" />
              Suggested
            </TabsTrigger>
          </TabsList>

          <TabsContent value="convos" className="flex-1 min-h-0 overflow-y-auto p-2 mt-2">
            {loadingList ? (
              <p className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading history…
              </p>
            ) : conversations.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8 px-4">
                No conversations yet. Click <strong>New Chat</strong> to start one.
              </p>
            ) : (
              <div className="space-y-1">
                {conversations.map(c => (
                  // Row, not a button: the delete control is a button of its
                  // own, and a button inside a button is invalid markup that
                  // keyboard users cannot reach.
                  <div
                    key={c.session_id}
                    className={`group flex items-center gap-1 rounded-md text-xs transition ${
                      active.sessionId === c.session_id
                        ? "bg-purple-50 text-purple-900 border border-purple-200"
                        : "hover:bg-muted/60 border border-transparent"
                    }`}
                  >
                    <button
                      onClick={() => openConversation(c)}
                      disabled={loadingConvo}
                      className="flex-1 min-w-0 p-2 text-left disabled:opacity-60"
                      aria-current={active.sessionId === c.session_id ? "true" : undefined}
                    >
                      <p className="font-medium truncate">{c.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {c.updated_at ? new Date(c.updated_at).toLocaleDateString() : ""}
                        {c.message_count ? ` · ${c.message_count} messages` : ""}
                      </p>
                    </button>
                    <button
                      onClick={(e) => deleteConversation(c.session_id, e)}
                      disabled={pendingDelete === c.session_id}
                      className="mr-1 shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 p-1 hover:bg-destructive/10 text-destructive rounded transition"
                      aria-label={`Delete conversation: ${c.title}`}
                    >
                      {pendingDelete === c.session_id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Trash2 className="h-3 w-3" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="suggested" className="flex-1 min-h-0 overflow-y-auto p-3 mt-2 space-y-2">
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => startNewConversation({ prompt: s })}
                className="w-full text-left text-xs p-2.5 rounded-md border border-border/60 bg-white hover:bg-purple-50 hover:border-purple-300 transition"
              >
                {s}
              </button>
            ))}
          </TabsContent>
        </Tabs>
      </aside>

      {/* ── Main chat pane ─────────────────────────────────────────── */}
      <main className="min-h-0 overflow-hidden">
        <ChatConversation
          key={resetKey}
          sessionId={active.sessionId}
          onSessionId={handleSessionId}
          initialMessages={messages}
          initialMessage={pendingPrompt}
          onMessagesChange={handleMessagesChange}
          bubbleWidthClass="max-w-[80%]"
          emptyStateTitle="How can I help?"
          emptyStateSubtitle="Ask about your campaigns, leads, opportunities, or custom metrics."
          showQuickActions
        />
      </main>
    </div>
  )
}
