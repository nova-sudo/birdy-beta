"use client"
import { Card } from "@/components/ui/card"
import { Bird } from "lucide-react"
import ChatConversation from "@/components/chat/ChatConversation"

/**
 * Client detail page embedded chat card.
 * Thin shell around ChatConversation.
 */
export default function BirdyChat({ clientName, clientId }) {
  const subtitle = clientName ? `Ask about ${clientName}'s performance` : "Ask about this client"
  const sessionKey = clientId ? `birdy_chat_client_${clientId}` : "birdy_chat_client"

  return (
    <Card className="h-[calc(100vh-280px)] min-h-[500px] bg-[#FAFAFA] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0 bg-white">
        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white">
          <Bird className="h-3.5 w-3.5" />
        </div>
        <div>
          <div className="text-sm font-semibold leading-tight">Birdy AI</div>
          <div className="text-[10px] text-muted-foreground leading-tight">{subtitle}</div>
        </div>
      </div>

      {/* Conversation */}
      <div className="flex-1 min-h-0">
        <ChatConversation
          sessionKey={sessionKey}
          composerCompact
          bubbleWidthClass="max-w-[90%]"
          emptyStateTitle="Ask me anything"
          emptyStateSubtitle="Campaign performance, leads, opportunities, tags — ask in plain English."
        />
      </div>
    </Card>
  )
}
