"use client"
import { Card } from "@/components/ui/card"
import ChatConversation from "@/components/chat/ChatConversation"

/**
 * Client detail page embedded chat card.
 * Scoped to a single client — passes clientGroupId + clientName to
 * ChatConversation which forwards them to the backend, where a dynamic
 * system prompt locks the AI to that client's data only.
 */
export default function BirdyChat({
  clientName,
  clientId,
  initialMessage = null,
  // Supplied by the Client Detail Ask Birdy tab, which owns a thread list and
  // therefore owns which conversation is open. Left undefined elsewhere, where
  // ChatConversation keeps its own sessionStorage-backed session.
  sessionId,
  onSessionId,
  initialMessages,
  onMessagesChange,
}) {
  const displayName = clientName || "this client"
  const sessionKey = clientId ? `birdy_chat_client_${clientId}` : "birdy_chat_client"

  return (
    // Height comes from the row this sits in — the Ask Birdy tab pins that to
    // the design's 660px — with the min-height covering the stacked layout
    // below lg, where the row has no height of its own.
    <Card className="flex h-full min-h-[500px] flex-col overflow-hidden rounded-2xl border-pd-border bg-pd-surface">
      {/* Header — the design titles the pane and says what it is scoped to,
          rather than badging it with an avatar. */}
      <div className="shrink-0 border-b border-pd-divider px-5 py-4">
        <div className="font-pd-display text-[15px] font-semibold text-pd-ink">
          Chat with Birdy
        </div>
        <div className="mt-0.5 text-[12px] text-pd-faint">
          Ask anything about {displayName} — campaigns, leads, calls and revenue.
        </div>
      </div>

      {/* Conversation */}
      <div className="flex-1 min-h-0">
        <ChatConversation
          sessionKey={sessionKey}
          page="client_detail"
          clientGroupId={clientId}
          clientName={clientName}
          initialMessage={initialMessage}
          sessionId={sessionId}
          onSessionId={onSessionId}
          initialMessages={initialMessages}
          onMessagesChange={onMessagesChange}
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
