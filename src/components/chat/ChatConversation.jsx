"use client"
import { useState, useRef, useEffect, useCallback } from "react"
import { Bird, Sparkles } from "lucide-react"
import { apiRequest } from "@/lib/api"
import MessageBubble from "@/components/chat/MessageBubble"
import TypingIndicator from "@/components/chat/TypingIndicator"
import ChatComposer from "@/components/chat/ChatComposer"

/**
 * The shared chat engine. Used by:
 *   - /ask-birdy full page
 *   - BirdyChatModal (header search → dialog)
 *   - BirdyChat (client detail card)
 *
 * Props:
 *   initialMessages?: array
 *   initialMessage?: string          — auto-sent on mount (used by the header search bar)
 *   sessionKey?: string              — sessionStorage key for the session_id
 *   onMessagesChange?: (msgs) => void — for callers that persist conversation history
 *   composerCompact?: boolean
 *   bubbleWidthClass?: string
 *   emptyStateTitle?, emptyStateSubtitle?
 *   showQuickActions?: boolean       — default true
 */
export default function ChatConversation({
  initialMessages = [],
  initialMessage = null,
  sessionKey = "birdy_chat_session",
  onMessagesChange,
  composerCompact = false,
  bubbleWidthClass = "max-w-[80%]",
  emptyStateTitle = "How can I help?",
  emptyStateSubtitle = "Ask about your campaigns, leads, opportunities, or custom metrics.",
  showQuickActions = true,
}) {
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [submittedUIs, setSubmittedUIs] = useState(new Set())
  const [sessionId, setSessionId] = useState(null)
  const scrollRef = useRef(null)
  const hasAutoSent = useRef(false)

  // Restore session from storage
  useEffect(() => {
    if (typeof window === "undefined") return
    const stored = sessionStorage.getItem(sessionKey)
    if (stored) setSessionId(stored)
  }, [sessionKey])

  // Notify parent of messages changes. Store the callback in a ref so
  // callers can pass an inline function without causing an infinite loop
  // (inline functions are fresh identities each render; only `messages`
  // should drive this effect).
  const onMessagesChangeRef = useRef(onMessagesChange)
  useEffect(() => { onMessagesChangeRef.current = onMessagesChange }, [onMessagesChange])
  useEffect(() => {
    onMessagesChangeRef.current?.(messages)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages])

  // Auto-scroll to latest
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, loading])

  // Send a message — optionally a hidden UI_RESPONSE or a real user message
  const sendMessage = useCallback(async (text, { hidden = false } = {}) => {
    if (!text || !text.trim() || loading) return
    const userMsg = { role: "user", content: text }
    setMessages(prev => [...prev, userMsg])
    setInput("")
    setLoading(true)
    try {
      const res = await apiRequest("/api/chat", {
        method: "POST",
        body: JSON.stringify({ message: text, session_id: sessionId }),
      })
      const data = res.ok ? await res.json() : { reply: "Sorry, something went wrong.", tools_used: [] }
      if (data.session_id) {
        setSessionId(data.session_id)
        sessionStorage.setItem(sessionKey, data.session_id)
      }
      setMessages(prev => [...prev, { role: "assistant", content: data.reply, tools_used: data.tools_used || [] }])
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I hit an error. Please try again.", tools_used: [] }])
    } finally {
      setLoading(false)
    }
  }, [loading, sessionId, sessionKey])

  // Auto-send initial message once
  useEffect(() => {
    if (initialMessage && !hasAutoSent.current) {
      hasAutoSent.current = true
      sendMessage(initialMessage)
    }
  }, [initialMessage, sendMessage])

  const handleUISubmit = (uiKey, values) => {
    setSubmittedUIs(prev => new Set(prev).add(uiKey))
    // Send as hidden UI response
    sendMessage(`[UI_RESPONSE] ${JSON.stringify(values)}`)
  }

  const handleSend = () => {
    if (!input.trim() || loading) return
    sendMessage(input)
  }

  const handleQuickAction = (prompt) => {
    sendMessage(prompt)
  }

  const visibleMessages = messages.filter(
    m => !(m.role === "user" && m.content?.startsWith("[UI_RESPONSE]"))
  )
  const isEmpty = visibleMessages.length === 0

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {isEmpty && !loading ? (
          <EmptyState title={emptyStateTitle} subtitle={emptyStateSubtitle} />
        ) : (
          <div className="space-y-3 max-w-4xl mx-auto">
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
      <div className="shrink-0 px-4 pb-4 pt-2 bg-gradient-to-t from-background to-transparent">
        <div className="max-w-4xl mx-auto">
          <ChatComposer
            value={input}
            onChange={setInput}
            onSend={handleSend}
            disabled={loading}
            compact={composerCompact}
            showQuickActions={showQuickActions && isEmpty}
            onQuickAction={handleQuickAction}
          />
        </div>
      </div>
    </div>
  )
}

function EmptyState({ title, subtitle }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6 py-12">
      <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/20 mb-4">
        <Bird className="h-7 w-7" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 text-sm text-muted-foreground max-w-sm">{subtitle}</p>
      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground/80">
        <Sparkles className="h-3 w-3 text-purple-500" />
        Try a quick action below, or type <kbd className="mx-0.5 px-1 py-0.5 rounded bg-muted font-sans">/</kbd> for commands
      </div>
    </div>
  )
}
