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

export default function MessageBubble({
  message,
  messageIndex,
  onUISubmit,
  submittedUIs,
  widthClass = "max-w-[80%]",
}) {
  const isUser = message.role === "user"

  if (isUser && message.content?.startsWith("[UI_RESPONSE]")) return null

  const parsed = !isUser ? parseChatUI(message.content) : null

  const hasWideBlock = !isUser && parsed?.segments?.some(s =>
    ["chart", "stats", "metric", "ui"].includes(s.type)
  )
  const effectiveWidth = hasWideBlock ? "w-full max-w-2xl" : widthClass

  if (isUser) {
    return (
      <div className="flex justify-end items-end gap-2">
        <div className={`${widthClass} bg-[#713cdd] text-white rounded-2xl rounded-br-sm px-4 py-2.5`}>
          <p className="text-sm leading-relaxed">{message.content}</p>
        </div>
        <div className="h-7 w-7 rounded-full bg-purple-100 flex items-center justify-center shrink-0 mb-0.5">
          <span className="text-[10px] font-bold text-purple-600">You</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2.5">
      {/* Birdy avatar */}
      <div className="h-7 w-7 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shrink-0 mt-0.5 shadow-sm shadow-purple-200">
        <Bird className="h-3.5 w-3.5 text-white" />
      </div>

      <div className={`${effectiveWidth} space-y-1`}>
        {/* Bubble */}
        <div className="bg-white rounded-2xl rounded-tl-sm border border-gray-100 shadow-sm px-4 py-3">
          <div className="prose prose-sm max-w-none text-gray-800
            prose-headings:text-gray-900 prose-headings:font-semibold
            prose-p:text-gray-700 prose-p:leading-relaxed prose-p:my-1
            prose-strong:text-gray-900
            prose-ul:my-1 prose-li:my-0
            prose-code:text-purple-700 prose-code:bg-purple-50 prose-code:px-1 prose-code:rounded prose-code:text-xs">
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
        </div>

        {/* Tool pills */}
        {message.tools_used?.length > 0 && (
          <div className="flex flex-wrap gap-1 px-1">
            {(() => {
              const counts = new Map()
              for (const t of message.tools_used) counts.set(t, (counts.get(t) || 0) + 1)
              return [...counts.entries()].map(([tool, n]) => (
                <ToolPill key={tool} name={tool} count={n > 1 ? n : undefined} />
              ))
            })()}
          </div>
        )}
      </div>
    </div>
  )
}
