"use client"
import { CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react"

/**
 * Renders a colored status badge from a :::status block.
 *
 * Payload:  { label, variant?: "success"|"warning"|"error"|"info", detail? }
 */
const VARIANTS = {
  success: { wrap: "bg-pd-success text-white", dot: "bg-white", icon: CheckCircle2, iconClass: "text-white" },
  warning: { wrap: "bg-pd-warning text-white", dot: "bg-white", icon: AlertTriangle, iconClass: "text-white" },
  error: { wrap: "bg-pd-danger text-white", dot: "bg-white", icon: XCircle, iconClass: "text-white" },
  info: { wrap: "bg-pd-info text-white", dot: "bg-white", icon: Info, iconClass: "text-white" },
}

export default function StatusBadge({ payload }) {
  if (!payload || !payload.label) return null
  const variant = VARIANTS[payload.variant] || VARIANTS.info
  const Icon = variant.icon

  return (
    <div className={`my-3 flex items-start gap-2.5 rounded-2xl px-3.5 py-2.5 ${variant.wrap}`}>
      <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${variant.iconClass}`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{payload.label}</div>
        {payload.detail && (
          <div className="mt-0.5 text-xs opacity-80">{payload.detail}</div>
        )}
      </div>
    </div>
  )
}
