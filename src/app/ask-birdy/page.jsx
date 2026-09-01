"use client"
import { useState, useEffect, useCallback, useMemo } from "react"
import { Globe, MessageSquarePlus, Trash2, Loader2, UserRound, Bird } from "lucide-react"
import { toast } from "sonner"
import { apiRequest } from "@/lib/api"
import ChatConversation from "@/components/chat/ChatConversation"
import { usePageHeader } from "@/components/page-header"
import { pdFontClass } from "@/lib/pd-fonts"
import { PdSegmented } from "@/components/portfolio"

// The Ask Birdy handoff's sidebar filter. Scope comes from the server: a
// thread is "client" while every tagged turn in it points at exactly one
// client, else "global" — derived per turn by the orchestrator, never stored.
const SCOPE_TABS = [
  { key: "all", label: "All" },
  { key: "global", label: "Global" },
  { key: "clients", label: "Clients" },
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
  const [scopeFilter, setScopeFilter] = useState("all")

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

  // Titles, ordering and scope are derived server-side, so refresh the list
  // once a turn completes rather than trying to mirror that logic here — the
  // header badge reads the active row out of the refreshed list.
  const handleMessagesChange = useCallback((msgs) => {
    setMessages(msgs)
    if (msgs.length > 0 && msgs[msgs.length - 1].role === "assistant") {
      loadConversations()
    }
  }, [loadConversations])

  // ── Scope of the active conversation ─────────────────────────────────────
  // One source of truth: the conversation list's own row. A brand-new chat
  // has no row yet and wears the neutral "not saved yet" pill until the first
  // reply lands and the list refresh brings its scope back.
  const activeConvo = useMemo(
    () => conversations.find(c => c.session_id === active.sessionId) || null,
    [conversations, active.sessionId]
  )
  const isClientScoped = activeConvo?.scope === "client" && activeConvo?.client_name

  const filteredConversations = useMemo(() => {
    if (scopeFilter === "global") return conversations.filter(c => c.scope !== "client")
    if (scopeFilter === "clients") return conversations.filter(c => c.scope === "client")
    return conversations
  }, [conversations, scopeFilter])

  // ── Global header slot: title + subtitle, like every other hub ──────────
  const header = useMemo(() => ({
    title: (
      <div className={`${pdFontClass} min-w-0`}>
        <h1 className="truncate font-pd-display text-[19px] font-bold leading-none tracking-[-0.02em] text-pd-ink">
          Ask Birdy
        </h1>
        <p className="mt-1 truncate text-[12px] leading-none text-pd-faint">
          Your marketing co-pilot across every client
        </p>
      </div>
    ),
    controls: null,
  }), [])
  usePageHeader(header)

  return (
    <div className={`${pdFontClass} flex h-full min-h-0 w-full gap-4`}>
      {/* ── Conversation sidebar (fixed 280px) ─────────────────────────── */}
      <aside className="flex w-[280px] shrink-0 flex-col overflow-hidden rounded-[16px] border border-pd-border bg-pd-surface">
        <div className="flex flex-col gap-3 border-b border-pd-border p-3">
          <button
            type="button"
            onClick={() => startNewConversation()}
            className="flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] bg-pd-primary font-pd-display text-[13px] font-semibold text-white transition-colors hover:bg-pd-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pd-primary"
          >
            <MessageSquarePlus className="size-4" aria-hidden="true" />
            New Chat
          </button>
          <PdSegmented
            label="Conversation scope"
            options={SCOPE_TABS}
            value={scopeFilter}
            onChange={setScopeFilter}
            itemClassName="flex-1 px-2 py-[5px] text-[12px]"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {loadingList ? (
            <p className="flex items-center justify-center gap-2 py-8 text-[12px] text-pd-faint">
              <Loader2 className="size-3 animate-spin" />
              Loading history…
            </p>
          ) : filteredConversations.length === 0 ? (
            <p className="px-4 py-8 text-center text-[12px] text-pd-faint">
              {conversations.length === 0
                ? <>No conversations yet. Click <strong>New Chat</strong> to start one.</>
                : "Nothing in this scope yet."}
            </p>
          ) : (
            <div className="space-y-1">
              {filteredConversations.map(c => {
                const selected = active.sessionId === c.session_id
                const clientScoped = c.scope === "client" && c.client_name
                return (
                  // Row, not a button: the delete control is a button of its
                  // own, and a button inside a button is invalid markup that
                  // keyboard users cannot reach.
                  <div
                    key={c.session_id}
                    className={`group flex items-center gap-1 overflow-hidden rounded-[10px] transition-colors ${
                      selected ? "bg-pd-primary-tint" : "hover:bg-pd-divider"
                    }`}
                  >
                    <button
                      onClick={() => openConversation(c)}
                      disabled={loadingConvo}
                      className="min-w-0 flex-1 cursor-pointer p-2 text-left disabled:opacity-60"
                      aria-current={selected ? "true" : undefined}
                    >
                      {/* Badge first, hard-clipped so a long client name can
                          never push the sidebar wider — see the handoff. */}
                      <span
                        className={`mb-1 flex w-fit max-w-full items-center gap-1 overflow-hidden rounded-full px-2 py-px text-[10px] font-semibold ${
                          clientScoped
                            ? "bg-pd-primary-tint text-pd-primary"
                            : "bg-pd-info-bg text-pd-info"
                        }`}
                      >
                        {clientScoped
                          ? <UserRound className="size-2.5 shrink-0" aria-hidden="true" />
                          : <Globe className="size-2.5 shrink-0" aria-hidden="true" />}
                        <span className="truncate">{clientScoped ? c.client_name : "Global"}</span>
                      </span>
                      <p className={`truncate text-[12.5px] ${
                        selected ? "font-semibold text-[#4A3AA0]" : "font-medium text-pd-ink"
                      }`}>
                        {c.title}
                      </p>
                      <p className="mt-0.5 truncate text-[10.5px] text-pd-faint">
                        {c.updated_at ? new Date(c.updated_at).toLocaleDateString() : ""}
                        {c.message_count ? ` · ${c.message_count} messages` : ""}
                      </p>
                    </button>
                    <button
                      onClick={(e) => deleteConversation(c.session_id, e)}
                      disabled={pendingDelete === c.session_id}
                      className="mr-1 shrink-0 rounded p-1 text-pd-danger opacity-0 transition hover:bg-pd-danger-bg focus-visible:opacity-100 group-hover:opacity-100"
                      aria-label={`Delete conversation: ${c.title}`}
                    >
                      {pendingDelete === c.session_id
                        ? <Loader2 className="size-3 animate-spin" />
                        : <Trash2 className="size-3" />}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </aside>

      {/* ── Chat pane ──────────────────────────────────────────────────── */}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[16px] border border-pd-border bg-pd-surface">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-pd-border px-5 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-pd-primary text-white">
              <Bird className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-pd-display text-[14.5px] font-semibold leading-tight text-pd-ink">
                {activeConvo ? "Chat with Birdy" : "New conversation"}
              </h2>
              <p className="truncate text-[11.5px] leading-tight text-pd-faint">
                {isClientScoped
                  ? `Scoped to ${activeConvo.client_name} — Birdy answers from this client's data.`
                  : activeConvo
                    ? "Birdy answers from every client in your workspace."
                    : "Ask anything — this chat is saved once you send your first message."}
              </p>
            </div>
          </div>

          {/* The second half of the global/client indicator: a scope badge
              pinned to the right, neutral until a new chat is saved. */}
          {isClientScoped ? (
            <span className="flex max-w-[40%] items-center gap-1.5 overflow-hidden rounded-full border border-[#E3DAFB] bg-pd-primary-tint px-2.5 py-1 text-[11px] font-semibold text-pd-primary">
              <UserRound className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{activeConvo.client_name} · client conversation</span>
            </span>
          ) : activeConvo ? (
            <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-[#D6E6FA] bg-pd-info-bg px-2.5 py-1 text-[11px] font-semibold text-pd-info">
              <Globe className="size-3" aria-hidden="true" />
              Global conversation
            </span>
          ) : (
            <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-pd-border bg-[#F4F4F8] px-2.5 py-1 text-[11px] font-semibold text-pd-subtle">
              <Globe className="size-3" aria-hidden="true" />
              Global · not saved yet
            </span>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          {/* No clientGroupId here even for client-scoped threads: passing it
              would pin the analysis tools to that client (see
              _CLIENT_PINNED_GROUP_TOOLS) — right on a client's own page,
              wrong on the workspace hub, where the user may pivot to another
              client mid-thread. Scope stays derived from what the model
              actually queries. */}
          <ChatConversation
            key={resetKey}
            sessionId={active.sessionId}
            onSessionId={handleSessionId}
            initialMessages={messages}
            initialMessage={pendingPrompt}
            onMessagesChange={handleMessagesChange}
            bubbleWidthClass="max-w-[80%]"
            composerPlaceholder={
              isClientScoped
                ? `Ask Birdy about ${activeConvo.client_name}…`
                : "Ask Birdy about the whole workspace…"
            }
            emptyStateTitle="Start a new conversation"
            emptyStateSubtitle="Ask about your campaigns, leads, opportunities, or custom metrics — across every client, or drill into one."
            showQuickActions
          />
        </div>
      </main>
    </div>
  )
}
