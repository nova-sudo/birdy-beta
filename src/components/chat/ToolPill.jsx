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
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${color.bg} ${color.text} ${color.border}`}
      title={count ? `${name} (${count}×)` : name}
    >
      <Icon className="h-3 w-3" />
      {meta.label}
      {count && <span className="opacity-60 tabular-nums">×{count}</span>}
    </span>
  )
}
