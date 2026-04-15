"use client"
import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Bird, Send, Sparkles, MessageSquarePlus, Trash2 } from "lucide-react"
import { apiRequest } from "@/lib/api"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { parseChatUI } from "@/lib/chat-ui-parser"
import ChatUIBlock from "@/components/chat/ChatUIBlock"

// ── Markdown components ──────────────────────────────────────────────────
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

  // Hide [UI_RESPONSE] messages from the user
  if (isUser && message.content?.startsWith("[UI_RESPONSE]")) return null

  // Parse AI messages for :::ui blocks
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
  "Give me a summary of all my clients",
  "How many leads did I get this week?",
  "Compare this week to last week",
  "Which campaign has the best CTR?",
]

// ── Conversation storage helpers (localStorage) ──────────────────────────
const CONVOS_KEY = "birdy_conversations"

function loadConversations() {
  try {
    return JSON.parse(localStorage.getItem(CONVOS_KEY) || "[]")
  } catch { return [] }
}

function saveConversations(convos) {
  localStorage.setItem(CONVOS_KEY, JSON.stringify(convos))
}

// ── Main Page ────────────────────────────────────────────────────────────

export default function AskBirdyPage() {
  const [conversations, setConversations] = useState([])
  const [activeConvoId, setActiveConvoId] = useState(null)
  const [messages, setMessages] = useState([])
  const [sessionId, setSessionId] = useState(null)
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [submittedUIs, setSubmittedUIs] = useState(new Set())
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Load conversations from localStorage on mount
  useEffect(() => {
    const convos = loadConversations()
    setConversations(convos)
    if (convos.length > 0) {
      const latest = convos[0]
      setActiveConvoId(latest.id)
      setMessages(latest.messages)
      setSessionId(latest.sessionId)
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  // Save current conversation whenever messages change
  useEffect(() => {
    if (!activeConvoId || messages.length === 0) return
    setConversations((prev) => {
      const updated = prev.map((c) =>
        c.id === activeConvoId ? { ...c, messages, sessionId, updatedAt: new Date().toISOString() } : c
      )
      saveConversations(updated)
      return updated
    })
  }, [messages, sessionId])

  const startNewConversation = () => {
    const id = `convo_${Date.now()}`
    const newConvo = {
      id,
      title: "New Conversation",
      messages: [],
      sessionId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const updated = [newConvo, ...conversations]
    setConversations(updated)
    saveConversations(updated)
    setActiveConvoId(id)
    setMessages([])
    setSessionId(null)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const switchConversation = (convo) => {
    setActiveConvoId(convo.id)
    setMessages(convo.messages)
    setSessionId(convo.sessionId)
  }

  const deleteConversation = (id, e) => {
    e.stopPropagation()
    const updated = conversations.filter((c) => c.id !== id)
    setConversations(updated)
    saveConversations(updated)
    if (activeConvoId === id) {
      if (updated.length > 0) {
        switchConversation(updated[0])
      } else {
        setActiveConvoId(null)
        setMessages([])
        setSessionId(null)
      }
    }
  }

  const sendMessage = useCallback(async (text) => {
    const message = text || input.trim()
    if (!message || loading) return

    // Auto-create a conversation if none active
    let convoId = activeConvoId
    if (!convoId) {
      const id = `convo_${Date.now()}`
      const newConvo = {
        id,
        title: message.slice(0, 60),
        messages: [],
        sessionId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      const updated = [newConvo, ...conversations]
      setConversations(updated)
      saveConversations(updated)
      setActiveConvoId(id)
      convoId = id
    }

    setInput("")
    const userMsg = { role: "user", content: message }
    setMessages((prev) => {
      const updated = [...prev, userMsg]
      // Update title from first message
      if (updated.filter((m) => m.role === "user").length === 1) {
        setConversations((cs) => {
          const u = cs.map((c) => c.id === convoId ? { ...c, title: message.slice(0, 60) } : c)
          saveConversations(u)
          return u
        })
      }
      return updated
    })
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
      if (data.session_id) setSessionId(data.session_id)
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
  }, [input, loading, sessionId, activeConvoId, conversations])

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
    <div className="flex flex-col h-[calc(100vh-90px)] overflow-hidden">
      {/* Page header */}
      <div className="pb-4 shrink-0">
        <h1 className="text-3xl font-bold">Ask Birdy</h1>
        <p className="text-muted-foreground text-sm">Your agency-level AI assistant</p>
      </div>

      {/* Main grid: sidebar + chat */}
      <div className="grid grid-cols-[280px_1fr] gap-4 flex-1 min-h-0">
        {/* Sidebar */}
        <div className="border rounded-lg flex flex-col overflow-hidden bg-white">
          <Tabs defaultValue="convos" className="flex flex-col h-full">
            <div className="border-b">
              <TabsList className="w-full grid grid-cols-2 rounded-none h-11 bg-muted/60">
                <TabsTrigger value="convos" className="text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  Convos
                </TabsTrigger>
                <TabsTrigger value="suggested" className="text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  Suggested
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="convos" className="flex-1 flex flex-col m-0 overflow-hidden data-[state=inactive]:hidden">
              <div className="p-3 border-b">
                <Button variant="outline" size="sm" className="w-full text-xs" onClick={startNewConversation}>
                  <MessageSquarePlus className="mr-2 h-3.5 w-3.5" />
                  New Conversation
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <div className="space-y-1 p-3">
                  {conversations.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-8">No conversations yet</p>
                  )}
                  {conversations.map((convo) => (
                    <div
                      key={convo.id}
                      onClick={() => switchConversation(convo)}
                      className={`p-3 rounded-lg cursor-pointer hover:bg-accent/50 transition-colors group relative ${
                        activeConvoId === convo.id ? "bg-accent" : ""
                      }`}
                    >
                      <div className="font-medium text-sm truncate pr-8">{convo.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(convo.updatedAt).toLocaleDateString()}
                      </div>
                      <button
                        onClick={(e) => deleteConversation(convo.id, e)}
                        className="absolute right-2 top-2 h-6 w-6 flex items-center justify-center rounded hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="suggested" className="flex-1 m-0 overflow-hidden p-3 data-[state=inactive]:hidden">
              <div className="space-y-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="w-full text-left text-xs px-3 py-2.5 rounded-lg border border-border/60 bg-white hover:bg-purple-50 hover:border-purple-200 transition-colors text-muted-foreground hover:text-purple-700"
                  >
                    <Sparkles className="h-3 w-3 inline mr-1.5 text-purple-400" />
                    {s}
                  </button>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Chat area */}
        <div className="border rounded-lg flex flex-col overflow-hidden bg-white min-h-0">
          <div className="border-b p-4 shrink-0">
            <h3 className="font-semibold">Chat with Birdy</h3>
            <p className="text-sm text-muted-foreground">Ask me anything about your agency</p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center gap-3">
                <div className="h-14 w-14 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
                  <Bird className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Start a conversation</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Ask about your marketing data, compare periods, or manage alerts.
                  </p>
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
          <div className="border-t p-4 shrink-0">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                className="flex-1 h-10 px-4 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-purple-400"
                disabled={loading}
              />
              <Button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                size="sm"
                className="h-10 px-4 bg-purple-600 hover:bg-purple-700"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
