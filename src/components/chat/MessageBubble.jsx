"use client"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Bird } from "lucide-react"
import { parseChatUI } from "@/lib/chat-ui-parser"
import { mdComponents } from "@/lib/chat-markdown"
import ChatUIBlock from "@/components/chat/ChatUIBlock"
import ToolPill from "@/components/chat/ToolPill"
import MetricCard from "@/components/chat/blocks/MetricCard"
import InlineChart from "@/components/chat/blocks/InlineChart"
import StatusBadge from "@/components/chat/blocks/StatusBadge"
import StatsGrid from "@/components/chat/blocks/StatsGrid"

/**
 * Single source of truth for rendering chat messages.
 * Used by /ask-birdy, BirdyChatModal, and BirdyChat.
 *
 * Props:
 *   message: {role, content, tools_used?}
 *   messageIndex: stable index (for UI block keys)
 *   onUISubmit: (uiKey, values) => void   — called when a :::ui form submits
 *   submittedUIs: Set<string>             — keys of already-submitted UI blocks
 *   widthClass?: "max-w-[80%]" | "max-w-[85%]" — surface-specific bubble width
 */
export default function MessageBubble({
  message,
  messageIndex,
  onUISubmit,
  submittedUIs,
  widthClass = "max-w-[80%]",
}) {
  const isUser = message.role === "user"

  // Hide [UI_RESPONSE] messages — they're a behind-the-scenes submission payload
  if (isUser && message.content?.startsWith("[UI_RESPONSE]")) return null

  const parsed = !isUser ? parseChatUI(message.content) : null

  // Wide bubbles for assistant messages that contain a structured block
  // (charts, stats grids, metric cards, forms) — plain text/markdown stays at
  // the caller-supplied widthClass.
  const hasWideBlock = !isUser && parsed?.segments?.some(s =>
    ["chart", "stats", "metric", "ui"].includes(s.type)
  )
  const effectiveWidth = hasWideBlock ? "w-full max-w-[min(100%,880px)]" : widthClass

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <Avatar isUser={isUser} />
      <div
        className={`${effectiveWidth} rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-purple-600 text-white rounded-br-md"
            : "bg-white border border-border/60 shadow-sm rounded-bl-md"
        }`}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-td:text-foreground prose-th:text-foreground">
            {parsed?.segments.map((seg, i) => {
              const key = `${messageIndex}-${i}`
              switch (seg.type) {
                case "text":
                  return (
                    <ReactMarkdown key={key} remarkPlugins={[remarkGfm]} components={mdComponents}>
                      {seg.content}
                    </ReactMarkdown>
                  )
                case "ui":
                  return (
                    <ChatUIBlock
                      key={key}
                      fields={seg.fields}
                      disabled={submittedUIs?.has(key)}
                      onSubmit={(values) => onUISubmit?.(key, values)}
                    />
                  )
                case "metric":
                  return <MetricCard key={key} payload={seg.payload} />
                case "chart":
                  return <InlineChart key={key} payload={seg.payload} />
                case "status":
                  return <StatusBadge key={key} payload={seg.payload} />
                case "stats":
                  return <StatsGrid key={key} payload={seg.payload} />
                default:
                  return null
              }
            })}
          </div>
        )}

        {!isUser && message.tools_used?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-border/30">
            {message.tools_used.map((tool, i) => (
              <ToolPill key={`${tool}-${i}`} name={tool} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Avatar({ isUser }) {
  return (
    <div
      className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
        isUser
          ? "bg-purple-100 text-purple-600"
          : "bg-gradient-to-br from-purple-500 to-indigo-600 text-white"
      }`}
    >
      {isUser ? <span className="text-xs font-bold">You</span> : <Bird className="h-4 w-4" />}
    </div>
  )
}
