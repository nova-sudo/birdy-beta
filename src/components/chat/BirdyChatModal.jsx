"use client"
import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { MessageSquarePlus, Maximize2, X } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import BirdyAvatar from "@/components/birdy/BirdyAvatar"
import ChatConversation from "@/components/chat/ChatConversation"
import { resetChat } from "@/lib/chat-store"
import { pageLabel } from "@/lib/chat-starters"
import { useClientGroups } from "@/lib/useClientGroups"
import { DEFAULT_DATE_PRESET } from "@/lib/constants"
import { EASE_OUT } from "@/components/motion"

// ─── The Birdy side panel ───────────────────────────────────────────────────
// ⌘K and the header search open this: a panel that slides in on the right and
// sits beside the page rather than over it. The page stays visible and
// scrollable, so a question can be about the table or chart you are looking
// at, and the panel says which page that is in its header.
//
// Not a modal on purpose: no scrim, no focus trap, nothing on the page is
// disabled. It closes from its own button or Escape — never from a click on
// the page, which is the thing you are meant to keep using.
//
// The file keeps its old name because the root layout imports it lazily by
// that name; the component is the panel.

const GLOBAL_SESSION_KEY = "birdy_chat_modal_session"

// The client a /clients/<id> page (or one of its sub-pages) is about.
function clientIdFromPath(pathname) {
  const m = pathname?.match(/^\/clients\/([^/]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

function getPageSlug(pathname) {
  if (!pathname) return null
  // First: a client id or sub-page can contain "lead", "metric" and the like.
  if (clientIdFromPath(pathname)) return "client_detail"
  const p = pathname.toLowerCase()
  if (p.includes("alert")) return "alerts"
  if (p.includes("sales-hub")) return "call_center"
  if (p.includes("campaign")) return "campaigns"
  if (p.includes("lead")) return "leads"
  if (p.includes("opportunit") || p.includes("pipeline")) return "opportunities"
  if (p.includes("metric")) return "custom_metrics"
  if (p.includes("dashboard") || p.includes("main-hub")) return "dashboard"
  return null
}

export default function BirdyChatModal({ open, onOpenChange, initialMessage = null, pathname = null }) {
  const page = getPageSlug(pathname)
  // On a client's own pages the chat is about that client only: it is sent
  // with every message, the client picker is hidden, and the conversation is
  // kept per client so another page's thread (and its prompt) can't leak in.
  const clientId = clientIdFromPath(pathname)
  const { clientGroups } = useClientGroups(DEFAULT_DATE_PRESET, { includeDaily: false })
  const clientName = clientId ? clientGroups.find((g) => g.id === clientId)?.name ?? null : null
  const context = clientId ? clientName : pageLabel(page)
  const sessionKey = clientId ? `birdy_chat_client_panel_${clientId}` : GLOBAL_SESSION_KEY
  // A fresh key remounts the conversation for "New".
  const [resetKey, setResetKey] = useState(0)
  // The question the header search seeded, held here so "New" can drop it:
  // the remount used to see the same prop again and send the question a
  // second time into the empty chat.
  const [seed, setSeed] = useState(initialMessage)
  useEffect(() => { setSeed(initialMessage) }, [initialMessage])

  const handleNewChat = () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(sessionKey)
    }
    // Transcript lives in chat-store (it survives close/reopen), so "New"
    // must clear it there too — the remount alone no longer empties it.
    resetChat(sessionKey)
    setSeed(null)
    setResetKey(k => k + 1)
  }

  // Escape closes, the way a dialog would — but only when the key lands
  // inside the panel, so a page's own Escape handling is left alone.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key !== "Escape") return
      if (!e.target?.closest?.("[data-birdy-panel]")) return
      onOpenChange(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onOpenChange])

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          data-birdy-panel
          role="dialog"
          aria-modal="false"
          aria-label="Ask Birdy"
          initial={{ x: 32, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 32, opacity: 0 }}
          transition={{ duration: 0.32, ease: EASE_OUT }}
          className="fixed inset-y-2 right-2 z-[60] flex w-[420px] max-w-[calc(100vw-16px)] flex-col overflow-hidden rounded-2xl border border-pd-border bg-pd-surface shadow-pd-popover sm:inset-y-3 sm:right-3"
        >
          {/* Header: who, where, and the three things you can do to the panel. */}
          <div className="flex shrink-0 items-center gap-2 border-b border-pd-divider bg-pd-surface px-3.5 py-2.5">
            <BirdyAvatar size={30} />
            <span className="font-pd-display text-[15px] font-bold leading-none text-pd-ink">Birdy</span>
            {context && (
              <span className="ml-1 truncate rounded-full bg-pd-primary-tint px-2 py-[3px] text-[11px] font-semibold text-pd-primary">
                {context}
              </span>
            )}
            <div className="ml-auto flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleNewChat}
                aria-label="New conversation"
                title="New conversation"
              >
                <MessageSquarePlus className="size-4" />
              </Button>
              <Button asChild variant="ghost" size="icon-sm" aria-label="Open Ask Birdy" title="Open Ask Birdy">
                <Link href="/ask-birdy" onClick={() => onOpenChange(false)}>
                  <Maximize2 className="size-4" />
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onOpenChange(false)}
                aria-label="Close"
                title="Close"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1">
            <ChatConversation
              key={`${sessionKey}:${resetKey}`}
              initialMessage={seed}
              sessionKey={sessionKey}
              page={page}
              clientGroupId={clientId}
              clientName={clientName}
              showScopePicker={!clientId}
              bubbleWidthClass="max-w-[92%]"
              composerCompact
              composerAutoFocus
              composerPlaceholder={context ? `Ask about the ${context}…` : "Ask Birdy anything…"}
              emptyStateTitle="What would you like to know?"
              emptyStateSubtitle={
                context
                  ? `Ask about what's on the ${context}, or anything else.`
                  : "Ask about campaigns, leads, calls, or any metric."
              }
            />
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
