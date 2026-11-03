"use client"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { Send, BarChart3, Bell, Users, TrendingUp, Paperclip, X, Film } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Button as DsButton, ProgressBar, toast } from "@/components/ds"
import { CREATIVE_ACCEPT, uploadCreativeMedia } from "@/lib/creative-upload"

const MAX_ATTACHMENTS = 4
const BLOB_HOST = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i

/** The upload result as the chat endpoint's attachment: no nulls, thumbnail only if it is a blob URL. */
function toAttachment(r) {
  const a = { blob_url: r.blob_url, mime: r.mime, bytes: r.bytes }
  if (r.width) a.width = r.width
  if (r.height) a.height = r.height
  if (r.duration_s != null) a.duration_s = r.duration_s
  if (r.thumbnail_url && BLOB_HOST.test(r.thumbnail_url)) a.thumbnail_url = r.thumbnail_url
  return a
}

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
 * onSend(attachments) receives the finished uploads (up to 4) as the chat
 * endpoint's attachment objects; it is called with [] when there are none.
 * The composer owns the chips and clears them on send.
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
  const fileRef = useRef(null)
  const idRef = useRef(0)
  // Chips: { id, name, kind, preview, progress, attachment|null }
  const [chips, setChips] = useState([])
  const chipsRef = useRef(chips)
  chipsRef.current = chips
  const [dragging, setDragging] = useState(false)
  const uploading = chips.some((c) => !c.attachment)

  const addFiles = (fileList) => {
    const files = Array.from(fileList || [])
    if (!files.length) return
    const room = MAX_ATTACHMENTS - chipsRef.current.length
    if (files.length > room) {
      toast.error(`You can attach up to ${MAX_ATTACHMENTS} files per message.`)
    }
    for (const file of files.slice(0, Math.max(room, 0))) {
      const id = ++idRef.current
      const preview = URL.createObjectURL(file)
      const chip = { id, name: file.name, kind: file.type.startsWith("video/") ? "video" : "image", preview, progress: 0, attachment: null }
      chipsRef.current = [...chipsRef.current, chip]
      setChips(chipsRef.current)
      const patch = (fn) => setChips((prev) => prev.map((c) => (c.id === id ? fn(c) : c)))
      uploadCreativeMedia(file, { onProgress: (p) => patch((c) => ({ ...c, progress: p })) })
        .then((res) => patch((c) => ({ ...c, progress: 100, attachment: toAttachment(res) })))
        .catch((err) => {
          // A chip removed mid-upload has nothing left to report on.
          if (chipsRef.current.some((c) => c.id === id)) {
            toast.error(err?.message || "Upload failed. Try again.")
          }
          removeChip(id)
        })
    }
  }

  const removeChip = (id) => {
    const chip = chipsRef.current.find((c) => c.id === id)
    if (chip) URL.revokeObjectURL(chip.preview)
    chipsRef.current = chipsRef.current.filter((c) => c.id !== id)
    setChips(chipsRef.current)
  }

  const send = () => {
    if (uploading) return
    const attachments = chipsRef.current.map((c) => c.attachment)
    chipsRef.current.forEach((c) => URL.revokeObjectURL(c.preview))
    chipsRef.current = []
    setChips([])
    onSend(attachments)
  }

  const onDrop = (e) => {
    if (!e.dataTransfer?.files?.length) return
    e.preventDefault()
    setDragging(false)
    if (!disabled) addFiles(e.dataTransfer.files)
  }

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

  const canSend = Boolean(value.trim()) && !disabled && !uploading

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !showSlash) {
      e.preventDefault()
      if (canSend) send()
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

  
  return (
    <div
      className="relative"
      onDragOver={(e) => {
        if (e.dataTransfer?.types?.includes("Files")) {
          e.preventDefault()
          setDragging(true)
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false)
      }}
      onDrop={onDrop}
    >
      {/* Slash command palette */}
      {slashMenuOpen && (
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

      {chips.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2 px-1" aria-label="Attachments">
          {chips.map((c) => (
            <li key={c.id} className="relative flex w-40 items-center gap-2 rounded-2xl border border-pd-border bg-pd-surface p-1.5 pr-8">
              {c.kind === "video" ? (
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-pd-divider text-pd-body">
                  <Film className="size-4" aria-hidden="true" />
                </span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.preview} alt="" className="size-9 shrink-0 rounded-xl object-cover" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] text-pd-ink">{c.name}</span>
                {!c.attachment && <ProgressBar value={c.progress} tone="primary" label={`Uploading ${c.name}`} className="mt-1" />}
              </span>
              <DsButton
                variant="ghost"
                size="icon-sm"
                className="absolute right-0.5 top-1/2 size-6 -translate-y-1/2 rounded-full"
                aria-label={`Remove ${c.name}`}
                onClick={() => removeChip(c.id)}
              >
                <X />
              </DsButton>
            </li>
          ))}
        </ul>
      )}

      {/* Input row */}
      {/* A raised card that lights up violet while you type in it. */}
      <div className={`flex items-end gap-2 border border-pd-border bg-pd-surface shadow-lg transition-[border-color,box-shadow] duration-200 focus-within:border-pd-primary focus-within:shadow-[0_0_0_4px_rgba(91,63,214,.12),var(--shadow-lg)]
        ${dragging ? "border-pd-primary" : ""}
        ${compact ? "rounded-[22px] p-1.5 pl-2" : "rounded-[26px] p-2 pl-3"}`}>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={CREATIVE_ACCEPT}
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files)
            e.target.value = ""
          }}
        />
        <DsButton
          variant="ghost"
          size={compact ? "icon-sm" : "icon"}
          className="shrink-0 rounded-full"
          aria-label="Attach images or videos"
          disabled={disabled || chips.length >= MAX_ATTACHMENTS}
          onClick={() => fileRef.current?.click()}
        >
          <Paperclip />
        </DsButton>
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
          onClick={send}
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
