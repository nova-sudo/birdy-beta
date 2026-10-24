import * as React from "react"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

const TONES = {
  info: "bg-info-soft text-info-ink",
  success: "bg-success-soft text-success-ink",
  warning: "bg-warning-soft text-warning-ink",
  danger: "bg-danger-soft text-danger-ink",
}

/**
 * Full-width strip above the shell for system-level state (impersonation,
 * disconnected data source, maintenance).
 *
 * @param {object} props
 * @param {"info"|"success"|"warning"|"danger"} [props.tone="info"]
 * @param {React.ReactNode} [props.action] Trailing action (a link or button)
 * @param {() => void} [props.onDismiss] Shows a dismiss button when given
 */
function SystemBanner({ tone = "info", children, action, onDismiss, className }) {
  return (
    <div
      data-ds="system-banner"
      role="status"
      className={cn(
        "flex w-full items-center gap-3 px-4 py-2 font-sans text-sm",
        TONES[tone] ?? TONES.info,
        className
      )}
    >
      <div className="min-w-0 flex-1 leading-snug">{children}</div>
      {action && <div className="shrink-0 font-medium">{action}</div>}
      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="flex size-6 shrink-0 items-center justify-center rounded-sm outline-none transition-colors hover:bg-foreground/10 focus-visible:shadow-control-focus"
        >
          <XIcon className="size-4" />
        </button>
      )}
    </div>
  )
}

export { SystemBanner }
