"use client"
import { useState, useRef, useEffect, useCallback } from "react"
import { Bird, Sparkles, Zap } from "lucide-react"
import { apiRequest } from "@/lib/api"
import MessageBubble from "@/components/chat/MessageBubble"
import TypingIndicator from "@/components/chat/TypingIndicator"
import ChatComposer from "@/components/chat/ChatComposer"

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
  page = null,
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
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [submittedUIs, setSubmittedUIs] = useState(new Set())
  const [sessionId, setSessionId] = useState(null)
  const scrollRef = useRef(null)
  const hasAutoSent = useRef(false)

  // Stable refs — prevents inline callbacks from recreating sendMessage every render
  const onMessagesChangeRef = useRef(onMessagesChange)
  const onToolUsedRef = useRef(onToolUsed)
  useEffect(() => { onMessagesChangeRef.current = onMessagesChange }, [onMessagesChange])
  useEffect(() => { onToolUsedRef.current = onToolUsed }, [onToolUsed])

  // Restore session
  useEffect(() => {
    if (typeof window === "undefined") return
    const stored = sessionStorage.getItem(sessionKey)
    if (stored) setSessionId(stored)
  }, [sessionKey])

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
    if (!text?.trim() || loading) return
    setMessages(prev => [...prev, { role: "user", content: text }])
    setInput("")
    setLoading(true)
    try {
      const res = await apiRequest("/api/chat", {
        method: "POST",
        body: JSON.stringify({ message: text, session_id: sessionId, page }),
      })
      const data = res.ok ? await res.json() : { reply: "Sorry, something went wrong.", tools_used: [] }
      if (data.session_id) {
        setSessionId(data.session_id)
        sessionStorage.setItem(sessionKey, data.session_id)
      }
      const toolsUsed = data.tools_used || []
      setMessages(prev => [...prev, { role: "assistant", content: data.reply, tools_used: toolsUsed }])
      toolsUsed.forEach(t => onToolUsedRef.current?.(t))
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I hit an error. Please try again.", tools_used: [] }])
    } finally {
      setLoading(false)
    }
  }, [loading, sessionId, sessionKey, page])

  // Auto-send once
  useEffect(() => {
    if (initialMessage && !hasAutoSent.current) {
      hasAutoSent.current = true
      sendMessage(initialMessage)
    }
  }, [initialMessage, sendMessage])

  const handleUISubmit = (uiKey, values) => {
    setSubmittedUIs(prev => new Set(prev).add(uiKey))
    sendMessage(`[UI_RESPONSE] ${JSON.stringify(values)}`)
  }

  const visibleMessages = messages.filter(
    m => !(m.role === "user" && m.content?.startsWith("[UI_RESPONSE]"))
  )
  const isEmpty = visibleMessages.length === 0

  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-50/50">
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
          <div className="max-w-2xl mx-auto px-5 py-5 space-y-4">
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
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <ChatComposer
            value={input}
            onChange={setInput}
            onSend={() => sendMessage(input)}
            disabled={loading}
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
      {/* Icon */}
      <div className="relative mb-5">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/25">
          <Bird className="h-8 w-8" />
        </div>
        <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-emerald-400 border-2 border-white flex items-center justify-center">
          <Zap className="h-2.5 w-2.5 text-white" />
        </div>
      </div>

      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-500 max-w-xs">{subtitle}</p>

      {/* Quick starters */}
      {quickStarters?.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2 justify-center max-w-sm">
          {quickStarters.map((s, i) => (
            <button
              key={i}
              onClick={() => onQuickStarter?.(s.prompt)}
              className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-white px-3.5 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-50 hover:border-purple-300 transition shadow-sm"
            >
              <Sparkles className="h-3 w-3 text-purple-400" />
              {s.label}
            </button>
          ))}
        </div>
      )}

      {showHints && (
        <p className="mt-4 text-[11px] text-gray-400">
          Type <kbd className="px-1 py-0.5 rounded bg-gray-100 font-sans text-gray-500">/</kbd> for commands
        </p>
      )}
    </div>
  )
}
