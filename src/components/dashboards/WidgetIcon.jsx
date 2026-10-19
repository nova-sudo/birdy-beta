"use client"
import {
  ChartColumn,
  ChartPie,
  Columns2,
  Funnel,
  Gauge,
  Heading,
  ListOrdered,
  Rows3,
  Sparkles,
  Table,
  TextAlignStart,
  TrendingUp,
} from "lucide-react"

/**
 * Lucide icons for dashkit's widget icon names (each widget definition's
 * `icon`), for Birdy's own dashboard UI around the editor: the view-mode
 * "Add widget" picker and the empty-state starters. The editor itself draws
 * dashkit's icons. A static map rather than lucide's dynamic import: it is a
 * closed set, and the bundle should carry only these.
 */
const ICONS = {
  gauge: Gauge,
  "rows-3": Rows3,
  text: TextAlignStart,
  heading: Heading,
  sparkles: Sparkles,
  "trending-up": TrendingUp,
  "bar-chart-3": ChartColumn,
  "pie-chart": ChartPie,
  "columns-2": Columns2,
  filter: Funnel,
  "list-ordered": ListOrdered,
  table: Table,
}

/**
 * One widget kind's icon. Decorative: the button around it carries the
 * label. An unknown name renders nothing. Size comes from `className`
 * (default `size-4`).
 *
 * @param {{name: string, className?: string}} props
 */
export function WidgetIcon({ name, className }) {
  // hasOwn: a name like "constructor" must not reach Object.prototype.
  const Icon = Object.hasOwn(ICONS, name) ? ICONS[name] : null
  if (!Icon) return null
  return <Icon className={className ?? "size-4"} aria-hidden="true" />
}
