"use client"
import { CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react"

/**
 * Renders a colored status badge from a :::status block.
 *
 * Payload:  { label, variant?: "success"|"warning"|"error"|"info", detail? }
 */
const VARIANTS = {
  success: {
    wrap: "bg-emerald-50 border-emerald-200 text-emerald-800",
    dot: "bg-emerald-500",
    icon: CheckCircle2,
    iconClass: "text-emerald-600",
  },
  warning: {
    wrap: "bg-amber-50 border-amber-200 text-amber-800",
    dot: "bg-amber-500",
    icon: AlertTriangle,
    iconClass: "text-amber-600",
  },
  error: {
    wrap: "bg-rose-50 border-rose-200 text-rose-800",
    dot: "bg-rose-500",
    icon: XCircle,
    iconClass: "text-rose-600",
  },
  info: {
    wrap: "bg-blue-50 border-blue-200 text-blue-800",
    dot: "bg-blue-500",
    icon: Info,
    iconClass: "text-blue-600",
  },
}

export default function StatusBadge({ payload }) {
  if (!payload || !payload.label) return null
  const variant = VARIANTS[payload.variant] || VARIANTS.info
  const Icon = variant.icon

  return (
    <div className={`my-3 flex items-start gap-2.5 rounded-lg border px-3 py-2 ${variant.wrap}`}>
      <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${variant.iconClass}`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{payload.label}</div>
        {payload.detail && (
          <div className="mt-0.5 text-xs opacity-80">{payload.detail}</div>
        )}
      </div>
    </div>
  )
}
