"use client"

import Link from "next/link"
import { Coins } from "lucide-react"

import { cn } from "@/lib/utils"
import { useCredits } from "@/hooks/useCredits"

const TONES = {
  success: { text: "text-success", bar: "bg-success" },
  warning: { text: "text-warning", bar: "bg-warning" },
  danger: { text: "text-danger", bar: "bg-danger" },
}

// Settings → Billing holds the balance, top-up packs and plan together.
const BILLING_HREF = "/settings?tab=billing"

/**
 * Credits-left block for the sidebar footer: remaining count, a bar of the
 * monthly allowance still unspent, and a one-line status. Links to billing.
 * Same data and copy as the legacy SidebarCredits; only the skin differs.
 */
export function SidebarCredits({ className }) {
  const { loading, balance, allowance, used, remainingAllowance, isOut, low, subscribed } = useCredits()

  const tone = TONES[isOut ? "danger" : low ? "warning" : "success"]
  // Top-ups keep the bar full even with the monthly allowance spent.
  const frac =
    allowance > 0 ? Math.max(0, Math.min(1, remainingAllowance / allowance)) : balance > 0 ? 1 : 0

  const status = isOut
    ? "Out — top up"
    : low
      ? "Running low — top up"
      : allowance > 0
        ? `${used.toLocaleString()} / ${allowance.toLocaleString()} used`
        : subscribed
          ? "Top-up balance"
          : "No plan — subscribe"

  return (
    <Link
      href={BILLING_HREF}
      data-ds="sidebar-credits"
      className={cn(
        "block rounded-control bg-muted px-3 py-2 outline-none transition-colors hover:bg-muted/70 focus-visible:shadow-control-focus",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Coins className={cn("size-3.5", tone.text)} />
          Credits
        </span>
        <span className={cn("num text-xs font-semibold", tone.text)}>
          {loading ? "…" : balance.toLocaleString()}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div
          className={cn("h-full rounded-full transition-[width]", tone.bar)}
          style={{ width: `${Math.round(frac * 100)}%` }}
        />
      </div>
      <p className={cn("mt-1 text-xs", isOut || low ? tone.text : "text-muted-foreground")}>{status}</p>
    </Link>
  )
}
