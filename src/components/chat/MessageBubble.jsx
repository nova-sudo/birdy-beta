"use client"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { useState } from "react"
import { motion } from "framer-motion"
import { AlertTriangle, Check, Copy, LayoutDashboard, Undo2 } from "lucide-react"
import BirdyAvatar from "@/components/birdy/BirdyAvatar"
import { EASE_SPRING } from "@/components/motion"
import { parseChatUI } from "@/lib/chat-ui-parser"
import { mdComponents } from "@/lib/chat-markdown"
import { delatex } from "@/lib/chat-math"
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
  onUndoDashboardOps = null,
}) {
  const isUser = message.role === "user"

  if (isUser && message.content?.startsWith("[UI_RESPONSE]")) return null

  const parsed = !isUser ? parseChatUI(message.content) : null


  // Your side is a soft pill on the right; Birdy's side is an unboxed,
  // full-width answer with the mascot and name above it — it reads like a
  // short report, which leaves room for the charts and tables it carries.
  if (isUser) {
    return (
      <motion.div
        className="flex justify-end"
        initial={{ opacity: 0, y: 18, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: EASE_SPRING }}
      >
        <div className={`${widthClass} rounded-[22px] bg-pd-divider px-4 py-2.5 text-pd-ink`}>
          <p className="whitespace-pre-wrap text-[14px] leading-relaxed">{message.content}</p>
        </div>
      </motion.div>
    )
  }

  // Collapse repeated tool calls into one pill with a count.
  const tools = (() => {
    if (!message.tools_used?.length) return []
    const counts = new Map()
    for (const t of message.tools_used) counts.set(t, (counts.get(t) || 0) + 1)
    return [...counts.entries()]
  })()

  return (
    <motion.div
      className="group flex flex-col gap-2"
      initial={{ opacity: 0, y: 22, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: EASE_SPRING }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <BirdyAvatar size={30} paused />
        <span className="font-pd-display text-[14px] font-bold text-pd-ink">Birdy</span>
        {tools.map(([tool, n]) => (
          <ToolPill key={tool} name={tool} count={n > 1 ? n : undefined} />
        ))}
      </div>

      <div className="w-full pl-[34px]">
          <div className="prose prose-sm max-w-none text-pd-body
            prose-headings:font-pd-display prose-headings:text-pd-ink prose-headings:font-semibold
            prose-p:text-pd-body prose-p:text-[14px] prose-p:leading-[1.65] prose-p:my-1.5
            prose-strong:text-pd-ink
            prose-ul:my-1.5 prose-li:my-0.5 prose-li:text-[14px]
            prose-code:text-pd-primary prose-code:bg-pd-primary-tint prose-code:px-1 prose-code:rounded-md prose-code:text-xs">
            {parsed?.segments.map((seg, i) => {
              const key = `${messageIndex}-${i}`
              switch (seg.type) {
                case "text":
                  return (
                    <ReactMarkdown key={key} remarkPlugins={[remarkGfm]} components={mdComponents}>
                      {delatex(seg.content)}
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

      {message.dashboard_ops?.length > 0 && (
        <div className="pl-[34px]">
          <DashboardChanges message={message} onUndo={onUndoDashboardOps} />
        </div>
      )}

      <div className="pl-[34px]">
        <CopyButton text={message.content} />
      </div>
    </motion.div>
  )
}

/**
 * What a "My dashboards" reply did to the dashboard: the diff lines the page
 * computed when it applied the ops, or why it couldn't. Styled like the tool
 * pills above the answer — a quiet receipt, not a second message.
 *
 * `onUndo` (only on the newest reply that changed the dashboard) takes those
 * changes back; it returns false when it could not, e.g. because the user has
 * edited the dashboard since.
 */
function DashboardChanges({ message, onUndo }) {
  const [undo, setUndo] = useState(null) // null | "done" | "blocked"
  const applied = message.dashboard_applied
  const title = applied ? "Updated your dashboard" : "Couldn't apply these changes"
  const Icon = applied ? LayoutDashboard : AlertTriangle
  const lines = applied ? message.dashboard_diff ?? [] : []

  return (
    <div
      role="status"
      aria-label={title}
      className={`rounded-2xl border bg-pd-surface px-3 py-2.5 ${applied ? "border-pd-border" : "border-pd-danger"}`}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-pd-body">
        <Icon className={`size-3 ${applied ? "text-pd-primary" : "text-pd-danger"}`} aria-hidden="true" />
        {title}
        {applied && onUndo && undo !== "done" && (
          <button
            type="button"
            onClick={() => setUndo(onUndo() ? "done" : "blocked")}
            className="ml-auto inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold text-pd-muted transition-colors hover:bg-pd-divider hover:text-pd-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pd-primary"
          >
            <Undo2 className="size-3" aria-hidden="true" />
            Undo
          </button>
        )}
        {applied && undo === "done" && <span className="ml-auto text-[11.5px] font-medium text-pd-faint">Undone</span>}
      </div>
      {lines.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 text-[12.5px] leading-snug text-pd-muted">
          {lines.map((line, i) => (
            <li key={i} className="flex gap-1.5">
              <span className="mt-[7px] size-1 shrink-0 rounded-full bg-pd-faint" aria-hidden="true" />
              <span className="min-w-0">{line}</span>
            </li>
          ))}
        </ul>
      )}
      {undo === "blocked" && (
        <p className="mt-1 text-[12.5px] leading-snug text-pd-muted">
          Newer edits came after this change. Use Undo in the editor to step back through them.
        </p>
      )}
      {!applied && message.dashboard_error && (
        <p className="mt-1 text-[12.5px] leading-snug text-pd-muted">{message.dashboard_error}</p>
      )}
    </div>
  )
}

/** Copies the raw answer; sits under each reply, quiet until hovered. */
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  if (!text || typeof navigator === "undefined" || !navigator.clipboard) return null
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          // Clipboard can be blocked (permissions, insecure origin) — nothing to do.
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium text-pd-subtle opacity-60 transition-[opacity,background-color,color] hover:bg-foreground/5 hover:text-pd-ink group-hover:opacity-100"
    >
      {copied ? <Check className="size-3.5 text-pd-success" /> : <Copy className="size-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  )
}
