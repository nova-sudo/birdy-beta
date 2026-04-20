"use client"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Bird, Sparkles, MessageSquarePlus, Trash2 } from "lucide-react"
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

export default function AskBirdyPage() {
  const [conversations, setConversations] = useState([])
  const [activeConvoId, setActiveConvoId] = useState(null)
  const [pendingPrompt, setPendingPrompt] = useState(null)
  const [resetKey, setResetKey] = useState(0) // force-remount ChatConversation on convo switch
  const savedMessagesRef = useRef([])

  // Load conversations from localStorage on mount
  useEffect(() => {
    const convos = loadConversations()
    setConversations(convos)
    if (convos.length > 0) {
      const latest = convos[0]
      setActiveConvoId(latest.id)
    } else {
      // Start empty — user has no saved convos
    }
  }, [])

  // Find the currently active convo object
  const activeConvo = conversations.find(c => c.id === activeConvoId) || null

  const startNewConversation = (opts = {}) => {
    const id = `convo_${Date.now()}`
    const newConvo = {
      id,
      title: opts.title || "New Conversation",
      messages: [],
      sessionId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const updated = [newConvo, ...conversations]
    setConversations(updated)
    saveConversations(updated)
    setActiveConvoId(id)
    setPendingPrompt(opts.prompt || null)
    setResetKey(k => k + 1)
  }

  const switchConversation = (convo) => {
    if (convo.id === activeConvoId) return
    setActiveConvoId(convo.id)
    setPendingPrompt(null)
    setResetKey(k => k + 1)
  }

  const deleteConversation = (id, e) => {
    e.stopPropagation()
    const updated = conversations.filter(c => c.id !== id)
    setConversations(updated)
    saveConversations(updated)
    if (activeConvoId === id) {
      if (updated.length > 0) {
        setActiveConvoId(updated[0].id)
      } else {
        setActiveConvoId(null)
      }
      setResetKey(k => k + 1)
    }
  }

  // Called by ChatConversation whenever its internal messages change
  const handleMessagesChange = (msgs) => {
    savedMessagesRef.current = msgs
    if (!activeConvoId) return
    setConversations(prev => {
      const updated = prev.map(c => {
        if (c.id !== activeConvoId) return c
        // Title from first user message
        let title = c.title
        if ((!title || title === "New Conversation") && msgs.length > 0) {
          const firstUser = msgs.find(m => m.role === "user" && !m.content?.startsWith("[UI_RESPONSE]"))
          if (firstUser) title = firstUser.content.slice(0, 40) + (firstUser.content.length > 40 ? "…" : "")
        }
        return { ...c, title, messages: msgs, updatedAt: new Date().toISOString() }
      })
      saveConversations(updated)
      return updated
    })
  }

  const handleSuggestion = (prompt) => {
    startNewConversation({ prompt, title: prompt.slice(0, 40) })
  }

  const sessionKey = activeConvoId ? `ask_birdy_convo_${activeConvoId}` : "ask_birdy_convo_new"
  const initialMessages = activeConvo?.messages || []

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
            {conversations.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8 px-4">
                No conversations yet. Click <strong>New Chat</strong> to start one.
              </p>
            ) : (
              <div className="space-y-1">
                {conversations.map(c => (
                  <button
                    key={c.id}
                    onClick={() => switchConversation(c)}
                    className={`w-full group flex items-start justify-between gap-2 p-2 rounded-md text-left text-xs transition ${
                      activeConvoId === c.id
                        ? "bg-purple-50 text-purple-900 border border-purple-200"
                        : "hover:bg-muted/60 border border-transparent"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{c.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(c.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      onClick={(e) => deleteConversation(c.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 text-destructive rounded transition cursor-pointer"
                      aria-label="Delete conversation"
                    >
                      <Trash2 className="h-3 w-3" />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="suggested" className="flex-1 min-h-0 overflow-y-auto p-3 mt-2 space-y-2">
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => handleSuggestion(s)}
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
          sessionKey={sessionKey}
          initialMessages={initialMessages}
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
