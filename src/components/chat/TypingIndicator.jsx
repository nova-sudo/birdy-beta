"use client"
import { useEffect, useState } from "react"
import { Bird } from "lucide-react"
import { getToolMeta, getCategoryColors } from "@/lib/chat-tool-icons"

/**
 * Shown while waiting for the AI response.
 *
 * Props:
 *   currentTool?: string  — real tool name (when backend streams tool_call events; currently not wired)
 *
 * When no currentTool is provided, rotates through friendly optimistic copy
 * so the user feels progress rather than a stalled UI.
 */

const FALLBACK_MESSAGES = [
  "Working on it",
  "Reading your data",
  "Crunching numbers",
  "Almost there",
]

export default function TypingIndicator({ currentTool }) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (currentTool) return
    const t = setInterval(() => setTick(i => i + 1), 1600)
    return () => clearInterval(t)
  }, [currentTool])

  let label = FALLBACK_MESSAGES[tick % FALLBACK_MESSAGES.length]
  let Icon = null
  let accent = getCategoryColors("group")

  if (currentTool) {
    const meta = getToolMeta(currentTool)
    label = meta.running
    Icon = meta.icon
    accent = getCategoryColors(meta.category)
  }

  return (
    <div className="flex gap-3">
      <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 bg-gradient-to-br from-purple-500 to-indigo-600 text-white">
        <Bird className="h-4 w-4" />
      </div>
      <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-white border border-border/60 shadow-sm px-4 py-3">
        <div className="flex gap-1">
          <span className={`h-1.5 w-1.5 rounded-full ${accent.dot} animate-bounce [animation-delay:-0.3s]`} />
          <span className={`h-1.5 w-1.5 rounded-full ${accent.dot} animate-bounce [animation-delay:-0.15s]`} />
          <span className={`h-1.5 w-1.5 rounded-full ${accent.dot} animate-bounce`} />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {Icon && <Icon className={`h-3.5 w-3.5 ${accent.text}`} />}
          <span className="transition-opacity">{label}…</span>
        </div>
      </div>
    </div>
  )
}
