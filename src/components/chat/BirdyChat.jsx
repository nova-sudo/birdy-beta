"use client"
import { Card } from "@/components/ui/card"
import { Bird } from "lucide-react"
import ChatConversation from "@/components/chat/ChatConversation"

/**
 * Client detail page embedded chat card.
 * Scoped to a single client — passes clientGroupId + clientName to
 * ChatConversation which forwards them to the backend, where a dynamic
 * system prompt locks the AI to that client's data only.
 */
export default function BirdyChat({ clientName, clientId }) {
  const displayName = clientName || "this client"
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
          <div className="text-[10px] text-muted-foreground leading-tight">
            Scoped to <span className="font-medium text-purple-600">{displayName}</span>
          </div>
        </div>
      </div>

      {/* Conversation */}
      <div className="flex-1 min-h-0">
        <ChatConversation
          sessionKey={sessionKey}
          page="client_detail"
          clientGroupId={clientId}
          clientName={clientName}
          composerCompact
          bubbleWidthClass="max-w-[90%]"
          emptyStateTitle={`Ask me about ${displayName}`}
          emptyStateSubtitle={`Campaign performance, leads, opportunities, and tags — all scoped to ${displayName}.`}
          showQuickActions={false}
          quickStarters={[
            { label: "Performance this week", prompt: `How is ${displayName} performing this week?` },
            { label: "Top campaigns", prompt: `What are ${displayName}'s top performing campaigns?` },
            { label: "Leads & pipeline", prompt: `Show me ${displayName}'s leads and pipeline status.` },
            { label: "Compare vs last week", prompt: `Compare ${displayName}'s performance this week vs last week.` },
          ]}
        />
      </div>
    </Card>
  )
}
