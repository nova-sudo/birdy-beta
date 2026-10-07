"use client"
import { useState, useRef, useEffect, useCallback } from "react"
import { Sparkles } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { apiRequest } from "@/lib/api"
import { useChat, sendChatMessage, seedSessionId, markUISubmitted } from "@/lib/chat-store"
import { useAiCredentials } from "@/hooks/useAiCredentials"
import { useCredits } from "@/hooks/useCredits"
import AiCredentialsEmptyState from "@/components/chat/AiCredentialsEmptyState"
import OutOfCreditsEmptyState from "@/components/chat/OutOfCreditsEmptyState"
import MessageBubble from "@/components/chat/MessageBubble"
import TypingIndicator from "@/components/chat/TypingIndicator"
import ChatComposer from "@/components/chat/ChatComposer"
import Birdy from "@/components/birdy/Birdy"
import { Reveal, Stagger, StaggerItem } from "@/components/motion"

/**
 * Shared chat engine used by /ask-birdy, BirdyChatModal, and inline surfaces.
 *
 * Props:
 *   initialMessages?        array of pre-seeded messages
 *   initialMessage?         auto-sent on mount
 *   sessionKey?             sessionStorage key for session_id
 *   page?                   slug scoping tools + system prompt
 *   onMessagesChange?       (msgs) => void
 *   onToolUsed?             (toolName) => void — fires per tool in a response
 *   composerPlaceholder?    string
 *   composerCompact?        boolean
 *   bubbleWidthClass?       Tailwind max-w class for text bubbles
 *   emptyStateTitle?
 *   emptyStateSubtitle?
 *   showQuickActions?       show chip row + /hint in empty state (default true)
 *   quickStarters?          [{label, prompt}] — context-specific starter chips
 */
export default function ChatConversation({
  initialMessages = [],
  initialMessage = null,
  sessionKey = "birdy_chat_session",
  sessionId: controlledSessionId,
  onSessionId,
  page = null,
  clientGroupId = null,
  clientName = null,
  onMessagesChange,
  onToolUsed = null,
  composerPlaceholder,
  composerCompact = false,
  bubbleWidthClass = "max-w-[75%]",
  emptyStateTitle = "How can I help?",
  emptyStateSubtitle = "Ask about your campaigns, leads, opportunities, or custom metrics.",
  showQuickActions = true,
  quickStarters = null,
}) {
  // Controlled (/ask-birdy) keeps component-local state: its history is
  // server-side and the session comes from the conversation being opened.
  // Uncontrolled surfaces (the modal, inline widgets) read from chat-store
  // instead, so a long analysis survives the modal being closed — the fetch
  // keeps running, the transcript is intact on reopen, and a toast fires if
  // the reply lands while nobody is watching.
  const isControlled = controlledSessionId !== undefined
  const storeChat = useChat(sessionKey)

  const [localMessages, setLocalMessages] = useState(initialMessages)
  const [localLoading, setLocalLoading] = useState(false)
  const [localSubmittedUIs, setLocalSubmittedUIs] = useState(new Set())
  const [sessionId, setSessionId] = useState(controlledSessionId ?? null)

  const messages = isControlled ? localMessages : storeChat.messages
  const loading = isControlled ? localLoading : storeChat.loading
  const submittedUIs = isControlled ? localSubmittedUIs : new Set(storeChat.submittedUIs)

  const [input, setInput] = useState("")
  // Shown once a request runs long enough that "just wait" stops being fair.
  const [slowNotice, setSlowNotice] = useState(false)
  const scrollRef = useRef(null)
  const hasAutoSent = useRef(false)
  const { configured, refresh: refreshCreds, markUnconfigured } = useAiCredentials()
  const { blocked: outOfCredits, refresh: refreshCredits } = useCredits()

  // Stable refs — prevents inline callbacks from recreating sendMessage every render
  const onMessagesChangeRef = useRef(onMessagesChange)
  const onToolUsedRef = useRef(onToolUsed)
  useEffect(() => { onMessagesChangeRef.current = onMessagesChange }, [onMessagesChange])
  useEffect(() => { onToolUsedRef.current = onToolUsed }, [onToolUsed])

  // Restore session — only when the caller isn't supplying one.
  useEffect(() => {
    if (isControlled) return
    if (typeof window === "undefined") return
    const stored = sessionStorage.getItem(sessionKey)
    if (stored) seedSessionId(sessionKey, stored)
  }, [sessionKey, isControlled])

  // Surface the "you can close this" hint only after a request has been
  // running a while — and only on closable surfaces (not /ask-birdy).
  useEffect(() => {
    if (!loading || isControlled) {
      setSlowNotice(false)
      return
    }
    const t = setTimeout(() => setSlowNotice(true), 6000)
    return () => clearTimeout(t)
  }, [loading, isControlled])

  const onSessionIdRef = useRef(onSessionId)
  useEffect(() => { onSessionIdRef.current = onSessionId }, [onSessionId])

  // Notify parent
  useEffect(() => {
    onMessagesChangeRef.current?.(messages)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages])

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, loading])

  const sendMessage = useCallback(async (text) => {
    if (!text?.trim() || loading || !configured) return
    if (outOfCredits) {
      toast.error("You're out of Birdy Credits", {
        description: "Top up to keep using Birdy AI.",
      })
      return
    }
    setInput("")

    if (!isControlled) {
      // Store-owned send: survives this component unmounting mid-request.
      await sendChatMessage(
        sessionKey,
        { text, page, clientGroupId, clientName },
        {
          persistSession: true,
          onSessionId: (id) => onSessionIdRef.current?.(id),
          onToolUsed: (t) => onToolUsedRef.current?.(t),
          on412: () => {
            markUnconfigured()
            refreshCreds()
            toast.error("AI not configured", {
              description: "Add your AI key in Settings to keep chatting.",
            })
          },
          on402: () => {
            refreshCredits?.()
            toast.error("You're out of Birdy Credits", {
              description: "Top up to keep using Birdy AI.",
            })
          },
          onSettled: () => refreshCredits?.(),
        },
      )
      return
    }

    setLocalMessages(prev => [...prev, { role: "user", content: text }])
    setLocalLoading(true)
    try {
      const res = await apiRequest("/api/chat", {
        method: "POST",
        body: JSON.stringify({ message: text, session_id: sessionId, page, client_group_id: clientGroupId, client_name: clientName }),
      })
      if (res.status === 412) {
        // Credentials were removed (e.g. in another tab) since this component last checked.
        markUnconfigured()
        refreshCreds()
        toast.error("AI not configured", {
          description: "Add your AI key in Settings to keep chatting.",
        })
        setLocalLoading(false)
        return
      }
      if (res.status === 402) {
        // Out of Birdy Credits (the server-side stopper). Refresh the balance so
        // the sidebar + composer reflect it, and prompt a top-up.
        refreshCredits?.()
        toast.error("You're out of Birdy Credits", {
          description: "Top up to keep using Birdy AI.",
        })
        setLocalLoading(false)
        return
      }
      const data = res.ok ? await res.json() : { reply: "Sorry, something went wrong.", tools_used: [] }
      if (data.session_id) {
        setSessionId(data.session_id)
        // A brand-new chat only learns its id from the first reply; the
        // conversation list needs it to keep pointing at the right thread.
        onSessionIdRef.current?.(data.session_id)
      }
      const toolsUsed = data.tools_used || []
      setLocalMessages(prev => [...prev, { role: "assistant", content: data.reply, tools_used: toolsUsed }])
      toolsUsed.forEach(t => onToolUsedRef.current?.(t))
      // Refresh the credit balance so the indicator reflects this question's spend.
      refreshCredits?.()
    } catch {
      setLocalMessages(prev => [...prev, { role: "assistant", content: "Sorry, I hit an error. Please try again.", tools_used: [] }])
    } finally {
      setLocalLoading(false)
    }
  }, [loading, sessionId, sessionKey, isControlled, page, clientGroupId, clientName, configured, markUnconfigured, refreshCreds, outOfCredits, refreshCredits])

  // Auto-send once — gated on `configured` so a header-search-seeded message
  // can't fire while the composer is hidden.
  useEffect(() => {
    if (initialMessage && configured && !hasAutoSent.current) {
      hasAutoSent.current = true
      sendMessage(initialMessage)
    }
  }, [initialMessage, configured, sendMessage])

  const handleUISubmit = (uiKey, values) => {
    if (isControlled) {
      setLocalSubmittedUIs(prev => new Set(prev).add(uiKey))
    } else {
      // Store-tracked so a reopened modal doesn't re-offer answered forms.
      markUISubmitted(sessionKey, uiKey)
    }
    sendMessage(`[UI_RESPONSE] ${JSON.stringify(values)}`)
  }

  const visibleMessages = messages.filter(
    m => !(m.role === "user" && m.content?.startsWith("[UI_RESPONSE]"))
  )
  const isEmpty = visibleMessages.length === 0

  if (!configured) {
    return (
      <div className="flex flex-col h-full min-h-0 bg-pd-canvas">
        <AiCredentialsEmptyState />
      </div>
    )
  }

  if (outOfCredits && isEmpty) {
    return (
      <div className="flex flex-col h-full min-h-0 bg-pd-canvas">
        <OutOfCreditsEmptyState />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-pd-canvas">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        {isEmpty && !loading ? (
          <EmptyState
            title={emptyStateTitle}
            subtitle={emptyStateSubtitle}
            showHints={showQuickActions}
            quickStarters={quickStarters}
            onQuickStarter={sendMessage}
          />
        ) : (
          <div className="max-w-3xl mx-auto px-5 py-6 space-y-6">
            {messages.map((m, i) => (
              <MessageBubble
                key={i}
                message={m}
                messageIndex={i}
                onUISubmit={handleUISubmit}
                submittedUIs={submittedUIs}
                widthClass={bubbleWidthClass}
              />
            ))}
            {loading && <TypingIndicator />}
            {loading && slowNotice && (
              <p className="pl-[34px] text-[12px] text-pd-faint">
                This is taking a little longer — likely a call analysis. You can
                close this window; you&apos;ll be notified when it&apos;s done.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="shrink-0 px-4 pb-4 pt-1">
        <div className="max-w-3xl mx-auto">
          {outOfCredits && (
            <div className="mb-2 flex items-center justify-between gap-2 rounded-full bg-pd-warning px-4 py-2 text-xs font-semibold text-white">
              <span>You&apos;re out of Birdy Credits.</span>
              <Link href="/billing" className="font-semibold underline underline-offset-2 hover:no-underline">
                Buy credits
              </Link>
            </div>
          )}
          <ChatComposer
            value={input}
            onChange={setInput}
            onSend={() => sendMessage(input)}
            disabled={loading || outOfCredits}
            compact={composerCompact}
            placeholder={composerPlaceholder}
            showQuickActions={showQuickActions && isEmpty}
            onQuickAction={sendMessage}
          />
        </div>
      </div>
    </div>
  )
}

function EmptyState({ title, subtitle, showHints, quickStarters, onQuickStarter }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6 py-16">
      {/* The mascot watches the cursor while it waits for a question. */}
      <Reveal className="mb-4">
        <Birdy size={84} />
      </Reveal>

      <Reveal delay={0.08}>
        <h3 className="font-pd-display text-[22px] font-bold tracking-[-0.02em] text-pd-ink">{title}</h3>
        <p className="mt-1.5 text-[14px] text-pd-subtle max-w-sm">{subtitle}</p>
      </Reveal>

      {/* Quick starters */}
      {quickStarters?.length > 0 && (
        <Stagger className="mt-6 flex flex-wrap gap-2 justify-center max-w-md" delay={0.2} gap={0.06}>
          {quickStarters.map((s, i) => (
            <StaggerItem
              as="button"
              key={i}
              onClick={() => onQuickStarter?.(s.prompt)}
              className="inline-flex items-center gap-1.5 rounded-full border border-pd-border bg-pd-surface px-4 py-2 text-[13px] font-semibold text-pd-ink shadow-xs transition-[border-color,background-color] hover:border-pd-primary hover:bg-pd-primary-tint/50 active:scale-[.97]"
            >
              <Sparkles className="h-3.5 w-3.5 text-pd-primary" />
              {s.label}
            </StaggerItem>
          ))}
        </Stagger>
      )}

      {showHints && (
        <p className="mt-5 text-[12px] text-pd-faint">
          Type <kbd className="px-1.5 py-0.5 rounded-md bg-pd-divider font-sans text-pd-body">/</kbd> for commands
        </p>
      )}
    </div>
  )
}
