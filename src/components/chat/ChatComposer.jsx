"use client"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { Send, Sparkles, BarChart3, Bell, Users, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"

const SLASH_COMMANDS = [
  { cmd: "/summary",   label: "Account summary",    icon: BarChart3, prompt: "Give me a summary of my account performance this week." },
  { cmd: "/compare",   label: "Compare periods",    icon: TrendingUp, prompt: "Compare this week vs last week across all my campaigns." },
  { cmd: "/leads",     label: "Recent leads",       icon: Users, prompt: "Show me my most recent leads with their opportunity status." },
  { cmd: "/alert",     label: "Create an alert",    icon: Bell, prompt: "Help me create an alert." },
]

const QUICK_ACTIONS = [
  { label: "Today's performance",   prompt: "How am I doing today across all client groups?" },
  { label: "Best campaigns",        prompt: "Which are my best performing campaigns this week?" },
  { label: "Leads to follow up",    prompt: "Which leads need follow-up right now?" },
  { label: "Create an alert",       prompt: "Help me create an alert." },
]

/**
 * Shared chat input composer.
 *
 * Props:
 *   value, onChange, onSend, disabled
 *   showQuickActions?: boolean   — show quick-action chips above the input (when chat is empty)
 *   onQuickAction?: (prompt) => void
 *   placeholder?
 *   compact?: boolean            — smaller padding, used in embedded surfaces
 *   autoFocus?: boolean
 */
export default function ChatComposer({
  value,
  onChange,
  onSend,
  disabled = false,
  showQuickActions = false,
  onQuickAction,
  placeholder = "Ask anything about your marketing data…",
  compact = false,
  autoFocus = false,
}) {
  const textareaRef = useRef(null)
  const [showSlash, setShowSlash] = useState(false)
  const [slashQuery, setSlashQuery] = useState("")

  // Auto-resize textarea
  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [value])

  // Auto-focus
  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus()
  }, [autoFocus])

  // ⌘K / Ctrl+K to focus composer from anywhere
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        textareaRef.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const handleChange = (e) => {
    const v = e.target.value
    onChange(v)
    // Show slash palette when line starts with "/"
    if (v.startsWith("/") && !v.includes(" ")) {
      setShowSlash(true)
      setSlashQuery(v.slice(1).toLowerCase())
    } else {
      setShowSlash(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !showSlash) {
      e.preventDefault()
      if (value.trim() && !disabled) onSend()
    }
    if (e.key === "Escape") {
      setShowSlash(false)
    }
  }

  const applySlash = (cmd) => {
    onChange(cmd.prompt)
    setShowSlash(false)
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  const filteredCommands = SLASH_COMMANDS.filter(c =>
    !slashQuery || c.cmd.slice(1).toLowerCase().startsWith(slashQuery)
  )

  const canSend = value.trim() && !disabled

  return (
    <div className="relative">
      {/* Slash command palette */}
      {showSlash && filteredCommands.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-2 rounded-lg border border-border bg-white shadow-lg overflow-hidden z-20">
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground font-medium border-b border-border/40">
            Commands
          </div>
          {filteredCommands.map((c) => {
            const Icon = c.icon
            return (
              <button
                key={c.cmd}
                onClick={() => applySlash(c)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-purple-50 transition"
              >
                <Icon className="h-4 w-4 text-purple-600" />
                <span className="font-mono text-xs text-muted-foreground w-20">{c.cmd}</span>
                <span className="text-foreground/80">{c.label}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Quick action chips (empty-state) */}
      {showQuickActions && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {QUICK_ACTIONS.map((q, i) => (
            <button
              key={i}
              onClick={() => onQuickAction?.(q.prompt)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-white px-3 py-1.5 text-xs text-foreground/80 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 transition"
            >
              <Sparkles className="h-3 w-3 text-purple-500" />
              {q.label}
            </button>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className={`flex items-end gap-2 rounded-2xl border border-border/60 bg-white shadow-sm focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-100 transition ${compact ? "p-1.5" : "p-2"}`}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className={`flex-1 resize-none bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground/70 ${compact ? "px-2 py-1.5" : "px-3 py-2"} min-h-[28px] max-h-[160px] leading-relaxed`}
        />
        <Button
          onClick={onSend}
          disabled={!canSend}
          size="icon"
          className={`shrink-0 rounded-xl transition ${
            canSend
              ? "bg-purple-600 hover:bg-purple-700 text-white"
              : "bg-muted text-muted-foreground"
          } ${compact ? "h-8 w-8" : "h-9 w-9"}`}
          aria-label="Send message"
        >
          <Send className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        </Button>
      </div>

      {/* Hint row */}
      {!compact && (
        <div className="mt-1.5 px-1 flex items-center justify-between text-[10px] text-muted-foreground/70">
          <span>
            <kbd className="px-1 py-0.5 rounded bg-muted font-sans">Enter</kbd> to send ·
            <kbd className="ml-1.5 px-1 py-0.5 rounded bg-muted font-sans">Shift+Enter</kbd> new line ·
            <kbd className="ml-1.5 px-1 py-0.5 rounded bg-muted font-sans">/</kbd> commands
          </span>
          <span>
            <kbd className="px-1 py-0.5 rounded bg-muted font-sans">⌘K</kbd> focus
          </span>
        </div>
      )}
    </div>
  )
}
