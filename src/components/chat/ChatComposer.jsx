"use client"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { Send, BarChart3, Bell, Users, TrendingUp } from "lucide-react"
import { Button, Kbd, Textarea } from "@/components/ds"
import { cn } from "@/lib/utils"

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

  const filteredCommands = SLASH_COMMANDS.filter(c =>
    !slashQuery || c.cmd.slice(1).toLowerCase().startsWith(slashQuery)
  )
  const slashMenuOpen = showSlash && filteredCommands.length > 0

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !showSlash) {
      e.preventDefault()
      if (value.trim() && !disabled) onSend()
    }
    if (e.key === "Escape") {
      // Closing the menu uses up the key: a drawer or dialog around the
      // chat that closes on Escape checks defaultPrevented and stays open.
      if (slashMenuOpen) e.preventDefault()
      setShowSlash(false)
    }
  }

  const applySlash = (cmd) => {
    onChange(cmd.prompt)
    setShowSlash(false)
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  const canSend = value.trim() && !disabled

  return (
    <div data-ds="chat-composer" className="relative">
      {/* Slash command palette */}
      {slashMenuOpen && (
        <div className="absolute bottom-full left-0 right-0 z-20 mb-2 overflow-hidden rounded-surface bg-background p-1 shadow-floating animate-in fade-in-0 slide-in-from-bottom-2 duration-200 motion-reduce:animate-none">
          <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
            Commands
          </div>
          {filteredCommands.map((c) => {
            const Icon = c.icon
            return (
              <button
                key={c.cmd}
                type="button"
                onClick={() => applySlash(c)}
                className="flex w-full items-center gap-2.5 rounded-control px-3 py-2 text-left text-sm outline-none transition-colors hover:bg-muted focus-visible:shadow-control-focus"
              >
                <Icon className="size-4 text-primary" aria-hidden="true" />
                <span className="w-20 font-mono text-xs text-muted-foreground">{c.cmd}</span>
                <span className="text-foreground">{c.label}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* One pill: field and send on a single centre line. It takes the
          focus ring while you type in it. */}
      <div
        className={cn(
          "flex items-end gap-2 bg-background shadow-floating transition-shadow duration-150 focus-within:shadow-control-focus",
          compact ? "rounded-[22px] p-1.5 pl-2" : "rounded-[26px] p-2 pl-3"
        )}
      >
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className={cn(
            "max-h-40 min-h-7 flex-1 resize-none rounded-none bg-transparent leading-relaxed shadow-none! field-sizing-fixed focus-visible:shadow-none!",
            compact ? "px-2 py-1.5" : "px-2 py-2"
          )}
        />
        <Button
          onClick={onSend}
          disabled={!canSend}
          variant={canSend ? "primary" : "secondary"}
          size={compact ? "icon-sm" : "icon"}
          className="shrink-0 rounded-full"
          aria-label="Send message"
        >
          <Send aria-hidden="true" />
        </Button>
      </div>

      {/* Foot: what the question is about on the left, the two keys worth
          knowing on the right. */}
      {(foot || !compact) && (
        <div className="mt-2 flex items-center justify-between gap-3 px-3 text-xs text-muted-foreground">
          <span className="min-w-0">{foot}</span>
          {!compact && (
            <span className="flex shrink-0 items-center gap-1">
              <Kbd>↵</Kbd> send ·
              <Kbd className="ml-1">/</Kbd> commands
            </span>
          )}
        </div>
      )}
    </div>
  )
}
