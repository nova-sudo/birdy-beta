"use client"

// A value someone has to copy and paste somewhere else — a script tag, a URL,
// a webhook secret.
//
// The whole setup flow is "take this exact string and put it over there", and
// getting it wrong by a character means nothing works with no error to explain
// why. So every one of those strings goes through this: selectable, wrapped
// rather than truncated (a script tag cut off at the edge of a box is the
// classic way to paste a broken one), and copied with a button rather than by
// hand.
//
// Nothing like this existed in the app before, so this is the one component the
// portal and the public install page both use.

import { useCallback, useState } from "react"
import { Check, Copy, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"

export default function CodeSnippet({
  value,
  label,
  hint,
  // Secrets start hidden: the portal is a screen people share and screenshot,
  // and a webhook secret in a support ticket is a secret no longer.
  secret = false,
  className,
}) {
  const [copied, setCopied] = useState(false)
  const [revealed, setRevealed] = useState(!secret)

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success(label ? `${label} copied` : "Copied")
      // Long enough to register, short enough that the button is ready again
      // before someone wants to paste it a second time.
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be refused outright (an insecure origin, a locked
      // down browser). Saying so beats a button that silently does nothing.
      toast.error("Couldn't copy — select the text and copy it manually")
    }
  }, [value, label])

  const masked = secret && !revealed

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium text-pd-body">{label}</span>
          {secret && (
            <button
              type="button"
              onClick={() => setRevealed((r) => !r)}
              className="flex items-center gap-1 text-[11px] text-pd-faint hover:text-pd-body"
            >
              {revealed ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
              {revealed ? "Hide" : "Show"}
            </button>
          )}
        </div>
      )}

      <div className="flex items-stretch gap-2">
        <code
          className={cn(
            "min-w-0 flex-1 rounded-[10px] border border-pd-border bg-pd-canvas px-3 py-2.5",
            "font-mono text-[11.5px] leading-[1.5] text-pd-ink",
            // Wrap, never truncate. A half-copied script tag is worse than an
            // ugly box.
            "whitespace-pre-wrap break-all",
          )}
        >
          {masked ? "•".repeat(Math.min(value?.length || 0, 44)) : value}
        </code>

        <button
          type="button"
          onClick={copy}
          aria-label={label ? `Copy ${label}` : "Copy"}
          className={cn(
            "flex h-auto shrink-0 items-center gap-1.5 self-stretch rounded-[10px] px-3",
            "text-[12px] font-medium transition-colors",
            copied
              ? "bg-pd-success-bg text-pd-success"
              : "bg-pd-primary text-white hover:opacity-90",
          )}
        >
          {copied ? <Check className="size-[14px]" /> : <Copy className="size-[14px]" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      {hint && <p className="text-[11.5px] leading-[1.45] text-pd-faint">{hint}</p>}
    </div>
  )
}
