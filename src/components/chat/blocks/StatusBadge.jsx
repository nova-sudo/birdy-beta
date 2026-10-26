"use client"
import { CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react"
import { Notice } from "@/components/ds"

/**
 * Renders a status callout from a :::status block.
 *
 * Payload:  { label, variant?: "success"|"warning"|"error"|"info", detail? }
 */
const VARIANTS = {
  success: { tone: "success", icon: CheckCircle2 },
  warning: { tone: "warning", icon: AlertTriangle },
  error: { tone: "danger", icon: XCircle },
  info: { tone: "info", icon: Info },
}

export default function StatusBadge({ payload }) {
  if (!payload || !payload.label) return null
  const variant = VARIANTS[payload.variant] || VARIANTS.info
  const Icon = variant.icon

  return (
    <Notice tone={variant.tone} className="not-prose my-3 items-start justify-start">
      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{payload.label}</div>
          {payload.detail && <div className="mt-0.5 text-xs opacity-80">{payload.detail}</div>}
        </div>
      </div>
    </Notice>
  )
}
