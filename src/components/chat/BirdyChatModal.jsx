"use client"
import { useState, useRef, useEffect, useCallback } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Bird, Send, Sparkles, X } from "lucide-react"
import { apiRequest } from "@/lib/api"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { parseChatUI } from "@/lib/chat-ui-parser"
import ChatUIBlock from "@/components/chat/ChatUIBlock"

// ── Markdown components (shared) ─────────────────────────────────────────
const mdComponents = {
  table: ({ children }) => (
    <div className="overflow-x-auto my-3">
      <table className="min-w-full text-sm border-collapse border border-border/40 rounded-lg">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-border/40 bg-muted/50 px-3 py-2 text-left font-semibold text-xs">{children}</th>
  ),
  td: ({ children }) => <td className="border border-border/40 px-3 py-2 text-xs">{children}</td>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-purple-400 bg-purple-50/50 pl-4 py-2 my-3 rounded-r-md">{children}</blockquote>
  ),
  hr: () => <hr className="my-4 border-border/40" />,
  a: ({ href, children }) => (
    <a href={href} className="text-purple-600 underline" target="_blank" rel="noopener noreferrer">{children}</a>
  ),
}

function MessageBubble({ message, messageIndex, onUISubmit, submittedUIs }) {
  const isUser = message.role === "user"

  if (isUser && message.content?.startsWith("[UI_RESPONSE]")) return null

  const parsed = !isUser ? parseChatUI(message.content) : null

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${
        isUser ? "bg-purple-100 text-purple-600" : "bg-gradient-to-br from-purple-500 to-indigo-600 text-white"
      }`}>
        {isUser ? <span className="text-[10px] font-bold">You</span> : <Bird className="h-3.5 w-3.5" />}
      </div>
      <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
        isUser ? "bg-purple-600 text-white rounded-br-md" : "bg-white border border-border/60 shadow-sm rounded-bl-md"
      }`}>
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-td:text-foreground prose-th:text-foreground">
            {parsed?.segments.map((seg, i) => {
              if (seg.type === "text") {
                return <ReactMarkdown key={i} remarkPlugins={[remarkGfm]} components={mdComponents}>{seg.content}</ReactMarkdown>
              }
              if (seg.type === "ui") {
                const uiKey = `${messageIndex}-${i}`
                return (
                  <ChatUIBlock
                    key={uiKey}
                    fields={seg.fields}
                    disabled={submittedUIs?.has(uiKey)}
                    onSubmit={(values) => onUISubmit?.(uiKey, values)}
                  />
                )
              }
              return null
            })}
          </div>
        )}
        {message.tools_used?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-border/30">
            {message.tools_used.map((tool, i) => (
              <span key={i} className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full">
                {tool.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="h-7 w-7 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center shrink-0">
        <Bird className="h-3.5 w-3.5" />
      </div>
      <div className="bg-white border border-border/60 shadow-sm rounded-2xl rounded-bl-md px-4 py-3">
        <div className="flex gap-1.5 items-center">
          <div className="h-2 w-2 bg-purple-400 rounded-full animate-bounce [animation-delay:0ms]" />
          <div className="h-2 w-2 bg-purple-400 rounded-full animate-bounce [animation-delay:150ms]" />
          <div className="h-2 w-2 bg-purple-400 rounded-full animate-bounce [animation-delay:300ms]" />
          <span className="text-xs text-muted-foreground ml-2">Birdy is thinking...</span>
        </div>
      </div>
    </div>
  )
}

const SUGGESTIONS = [
  "Give me a summary of all my clients",
  "How many leads did I get this week?",
  "Compare this week to last week",
  "Which campaign has the best CTR?",
]

export default function BirdyChatModal({ open, onOpenChange, initialMessage = "" }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [submittedUIs, setSubmittedUIs] = useState(new Set())
  const [sessionId, setSessionId] = useState(() => {
    if (typeof window !== "undefined") return sessionStorage.getItem("birdy_session_id")
    return null
  })
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const sentInitial = useRef(false)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  // Focus input when modal opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200)
  }, [open])

  // Send initial message from header search bar
  useEffect(() => {
    if (open && initialMessage && !sentInitial.current) {
      sentInitial.current = true
      sendMessage(initialMessage)
    }
    if (!open) sentInitial.current = false
  }, [open, initialMessage])

  const sendMessage = useCallback(async (text) => {
    const message = text || input.trim()
    if (!message || loading) return

    setInput("")
    setMessages((prev) => [...prev, { role: "user", content: message }])
    setLoading(true)

    try {
      const res = await apiRequest("/api/chat", {
        method: "POST",
        body: JSON.stringify({ message, session_id: sessionId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || "Failed to get response")
      }
      const data = await res.json()
      if (data.session_id) {
        setSessionId(data.session_id)
        sessionStorage.setItem("birdy_session_id", data.session_id)
      }
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply, tools_used: data.tools_used },
      ])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Sorry, I encountered an error: ${err.message}` },
      ])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [input, loading, sessionId])

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleUISubmit = (uiKey, values) => {
    setSubmittedUIs(prev => new Set([...prev, uiKey]))
    sendMessage(`[UI_RESPONSE] ${JSON.stringify(values)}`)
  }

  const handleNewChat = () => {
    setMessages([])
    setSessionId(null)
    setSubmittedUIs(new Set())
    sessionStorage.removeItem("birdy_session_id")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="bg-[#FAFAFA] sm:max-w-4xl w-[95vw] h-[85vh] max-h-[85vh] p-0 flex flex-col gap-0 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center shadow-sm">
              <Bird className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Chat with Birdy</h3>
              <p className="text-xs text-muted-foreground">Your AI marketing data assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={handleNewChat}>
              New Chat
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4">
              <div className="h-14 w-14 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
                <Bird className="h-7 w-7 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Ask Birdy anything</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  I can analyze your marketing data, compare campaigns, manage alerts, and find insights.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 max-w-md w-full mt-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-left text-xs px-3 py-2.5 rounded-xl border border-border/60 bg-white hover:bg-purple-50 hover:border-purple-200 transition-colors text-muted-foreground hover:text-purple-700"
                  >
                    <Sparkles className="h-3 w-3 inline mr-1.5 text-purple-400" />
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <MessageBubble key={i} message={msg} messageIndex={i} onUISubmit={handleUISubmit} submittedUIs={submittedUIs} />
              ))}
              {loading && <TypingIndicator />}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border/60 bg-white px-5 py-3 shrink-0">
          <div className="flex gap-2 items-end">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Birdy about your data..."
              className="flex-1 h-11 px-4 text-sm rounded-full border border-border/60 bg-[#FAFAFA] focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
              disabled={loading}
            />
            <Button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              size="icon"
              className="h-11 w-11 rounded-full bg-purple-600 hover:bg-purple-700 shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
