"use client"
import { useState, useRef, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import { Bird, Send, Sparkles } from "lucide-react"
import { apiRequest } from "@/lib/api"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { parseChatUI } from "@/lib/chat-ui-parser"
import ChatUIBlock from "@/components/chat/ChatUIBlock"

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
      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
        isUser ? "bg-purple-100 text-purple-600" : "bg-gradient-to-br from-purple-500 to-indigo-600 text-white"
      }`}>
        {isUser ? <span className="text-xs font-bold">You</span> : <Bird className="h-4 w-4" />}
      </div>
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
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
      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center shrink-0">
        <Bird className="h-4 w-4" />
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
  "Which ad has the highest spend?",
  "How many leads did I get this week?",
  "Compare this week to last week",
  "Which campaign has the best CTR?",
]

export default function BirdyChat() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [submittedUIs, setSubmittedUIs] = useState(new Set())
  const [sessionId, setSessionId] = useState(() => {
    if (typeof window !== "undefined") return sessionStorage.getItem("birdy_session_id")
    return null
  })
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  const sendMessage = async (text) => {
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
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }

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

  return (
    <Card className="flex flex-col h-[calc(100vh-280px)] min-h-[500px] bg-[#FAFAFA] border-border/60 overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4">
            <div className="h-16 w-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
              <Bird className="h-8 w-8 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Ask Birdy anything</h3>
              <p className="text-sm text-muted-foreground mt-1">
                I can analyze your marketing data, compare campaigns, and find insights.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 max-w-md w-full mt-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => sendMessage(suggestion)}
                  className="text-left text-xs px-3 py-2.5 rounded-xl border border-border/60 bg-white hover:bg-purple-50 hover:border-purple-200 transition-colors text-muted-foreground hover:text-purple-700"
                >
                  <Sparkles className="h-3 w-3 inline mr-1.5 text-purple-400" />
                  {suggestion}
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

      <div className="border-t border-border/60 bg-white p-3">
        <div className="flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Birdy about your data..."
            className="min-h-[44px] max-h-[120px] resize-none rounded-xl border-border/60 focus-visible:ring-purple-400 text-sm"
            rows={1}
            disabled={loading}
          />
          <Button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            size="icon"
            className="h-[44px] w-[44px] rounded-xl bg-purple-600 hover:bg-purple-700 shrink-0"
          >
            {loading ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </Card>
  )
}
