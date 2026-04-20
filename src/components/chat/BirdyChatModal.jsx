"use client"
import { useState } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Bird, MessageSquarePlus, ExternalLink } from "lucide-react"
import Link from "next/link"
import ChatConversation from "@/components/chat/ChatConversation"

/**
 * Global chat dialog. Triggered from the header "Ask Birdy..." search bar.
 * Thin shell around ChatConversation.
 */
export default function BirdyChatModal({ open, onOpenChange, initialMessage = null }) {
  // Use a "key" trick to force-remount ChatConversation for "New Chat"
  const [resetKey, setResetKey] = useState(0)

  const handleNewChat = () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("birdy_chat_modal_session")
    }
    setResetKey(k => k + 1)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 sm:max-w-4xl h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white">
              <Bird className="h-3.5 w-3.5" />
            </div>
            <div>
              <div className="text-sm font-semibold leading-tight">Birdy AI</div>
              <div className="text-[10px] text-muted-foreground leading-tight">Your marketing co-pilot</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={handleNewChat} className="h-8 gap-1.5 text-xs">
              <MessageSquarePlus className="h-3.5 w-3.5" />
              New
            </Button>
            <Link href="/ask-birdy" passHref legacyBehavior>
              <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
                <a>
                  <ExternalLink className="h-3.5 w-3.5" />
                  Expand
                </a>
              </Button>
            </Link>
          </div>
        </div>

        {/* Conversation */}
        <div className="flex-1 min-h-0 bg-[#FAFAFA]">
          <ChatConversation
            key={resetKey}
            initialMessage={initialMessage}
            sessionKey="birdy_chat_modal_session"
            bubbleWidthClass="max-w-[85%]"
            emptyStateTitle="What would you like to know?"
            emptyStateSubtitle="Ask about campaigns, leads, opportunities, or any metric."
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
