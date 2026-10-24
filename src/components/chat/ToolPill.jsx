"use client"
import { Badge } from "@/components/ds"
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
    <Badge tone="neutral" title={count ? `${name} (${count}×)` : name}>
      <span className={`size-1.5 rounded-full ${color.dot}`} aria-hidden="true" />
      <Icon aria-hidden="true" />
      {meta.label}
      {count && <span className="num opacity-60">×{count}</span>}
    </Badge>
  )
}
