"use client"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { Send, BarChart3, Bell, Users, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"

const SLASH_COMMANDS = [
  { cmd: "/summary",   label: "Account summary",    icon: BarChart3, prompt: "Give me a summary of my account performance this week." },
  { cmd: "/compare",   label: "Compare periods",    icon: TrendingUp, prompt: "Compare this week vs last week across all my campaigns." },
  { cmd: "/leads",     label: "Recent leads",       icon: Users, prompt: "Show me my most recent leads with their opportunity status." },
  { cmd: "/alert",     label: "Create an alert",    icon: Bell, prompt: "Help me create an alert." },
]


/**
 * Shared chat input composer.
 *
 * Props:
 *   value, onChange, onSend, disabled
 *   foot?: ReactNode             — sits under the input on the left: the scope picker
 *   placeholder?
 *   compact?: boolean            — smaller padding, used in embedded surfaces
 *   autoFocus?: boolean
 *
 * Starter chips used to render above the input; they live in the empty
 * state now (ChatConversation), where they can be about the page.
 */
export default function ChatComposer({
  value,
  onChange,
  onSend,
  disabled = false,
  foot = null,
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
        <div className="absolute bottom-full left-0 right-0 mb-2 rounded-2xl border border-pd-border bg-pd-surface p-1 shadow-pd-popover overflow-hidden z-20 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
          <div className="px-3 py-1.5 text-[11px] uppercase tracking-[.04em] text-pd-faint font-bold">
            Commands
          </div>
          {filteredCommands.map((c) => {
            const Icon = c.icon
            return (
              <button
                key={c.cmd}
                onClick={() => applySlash(c)}
                className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm hover:bg-pd-primary-tint transition-colors"
              >
                <Icon className="h-4 w-4 text-pd-primary" />
                <span className="font-mono text-xs text-muted-foreground w-20">{c.cmd}</span>
                <span className="text-foreground/80">{c.label}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Input row */}
      {/* A raised card that lights up violet while you type in it. */}
      <div className={`flex items-end gap-2 border border-pd-border bg-pd-surface shadow-lg transition-[border-color,box-shadow] duration-200 focus-within:border-pd-primary focus-within:shadow-[0_0_0_4px_rgba(91,63,214,.12),var(--shadow-lg)]
        ${compact ? "rounded-[22px] p-1.5 pl-2" : "rounded-[26px] p-2 pl-3"}`}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className={`flex-1 resize-none bg-transparent border-0 outline-none text-[14px] text-pd-ink placeholder:text-pd-faint ${compact ? "px-2 py-1.5" : "px-2 py-2"} min-h-[28px] max-h-[160px] leading-relaxed`}
        />
        <Button
          onClick={onSend}
          disabled={!canSend}
          size="icon"
          className={`shrink-0 rounded-full ${
            canSend ? "" : "bg-pd-divider text-pd-faint shadow-none"
          } ${compact ? "size-8" : "size-10"}`}
          aria-label="Send message"
        >
          <Send className={compact ? "h-3 w-3" : "h-4 w-4"} />
        </Button>
      </div>

      {/* Foot: what the question is about on the left, the two keys worth
          knowing on the right. The old row listed every shortcut; nobody
          reads a legend under every message. */}
      {(foot || !compact) && (
        <div className="mt-2 flex items-center justify-between gap-3 px-3 text-[11px] text-pd-faint">
          <span className="min-w-0">{foot}</span>
          {!compact && (
            <span className="shrink-0">
              <kbd className="rounded-md bg-pd-divider px-1 py-0.5 font-sans text-pd-body">↵</kbd> send ·
              <kbd className="ml-1.5 rounded-md bg-pd-divider px-1 py-0.5 font-sans text-pd-body">/</kbd> commands
            </span>
          )}
        </div>
      )}
    </div>
  )
}
