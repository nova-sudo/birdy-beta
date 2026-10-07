"use client"
import { getToolMeta, getCategoryColors } from "@/lib/chat-tool-icons"

/**
 * Small pill shown under an AI message listing which tools were used.
 * Icon + category color come from chat-tool-icons.js.
 */
export default function ToolPill({ name, count }) {
  const meta = getToolMeta(name)
  const color = getCategoryColors(meta.category)
  const Icon = meta.icon

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-pd-divider px-2.5 py-0.5 text-[11px] font-semibold text-pd-body"
      title={count ? `${name} (${count}×)` : name}
    >
      <span className={`size-1.5 rounded-full ${color.dot}`} aria-hidden="true" />
      <Icon className="h-3 w-3 text-pd-subtle" />
      {meta.label}
      {count && <span className="opacity-60 tabular-nums">×{count}</span>}
    </span>
  )
}
