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
import { Button } from "@/components/ds"

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
          <span className="text-xs font-medium text-body">{label}</span>
          {secret && (
            <button
              type="button"
              onClick={() => setRevealed((r) => !r)}
              className="flex items-center gap-1 rounded-sm text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:shadow-control-focus"
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
            "min-w-0 flex-1 rounded-control bg-muted px-3 py-2.5",
            "font-mono text-xs leading-normal text-foreground",
            // Wrap, never truncate. A half-copied script tag is worse than an
            // ugly box.
            "whitespace-pre-wrap break-all",
          )}
        >
          {masked ? "•".repeat(Math.min(value?.length || 0, 44)) : value}
        </code>

        <Button
          type="button"
          size="sm"
          variant={copied ? "outline" : "primary"}
          onClick={copy}
          aria-label={label ? `Copy ${label}` : "Copy"}
          className={cn("shrink-0 self-center", copied && "text-success-ink")}
        >
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>

      {hint && <p className="text-xs leading-snug text-muted-foreground">{hint}</p>}
    </div>
  )
}
