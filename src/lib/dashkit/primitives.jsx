"use client"
import {
  ChartColumn,
  ChartPie,
  CirclePlus,
  Columns2,
  Funnel,
  Gauge,
  GripVertical,
  LayoutDashboard,
  ListOrdered,
  Minus,
  MoveDiagonal,
  Plus,
  Redo2,
  Rows3,
  Sparkles,
  Table,
  TextAlignStart,
  TrendingUp,
  Undo2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// ─── dashkit's UI primitives, in Birdy's pd look ────────────────────────────
// dashkit renders its editor (toolbar, palette, property panel, canvas
// controls) through swappable Button / Input / Select / Menu / Icon slots.
// These fill them so the editor reads as part of Birdy, not a foreign widget.
//
// Each keeps dashkit's own class (dk-button, dk-input, dk-select) beside the
// pd utilities: dashkit's contextual layout rules key off those classes (the
// 24px canvas controls, the 64px palette tiles, the toolbar's borderless
// title, the section controls' flex sizing) and must keep applying. dashkit's
// stylesheet is unlayered, so its *base* rules for those classes would beat
// these Tailwind utilities; globals.css hands the base look back to the
// utilities with `revert-layer` while leaving the contextual rules in force.

const BUTTON_BASE =
  "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pd-primary"

const BUTTON_VARIANTS = {
  primary: "bg-pd-primary text-white hover:opacity-90",
  ghost: "text-pd-body hover:bg-pd-divider",
  default: "border border-pd-border bg-pd-surface hover:bg-pd-divider",
}

/**
 * dashkit's Button slot. `variant` is dashkit's (`primary` | `ghost` | none);
 * dashkit's `dk-button-<variant>` class is kept too, for the same reason as
 * `dk-button`. `type` defaults to "button": these sit inside forms in the
 * property panel and must never submit them.
 *
 * @param {{variant?: "primary"|"ghost", className?: string} & React.ButtonHTMLAttributes<HTMLButtonElement>} props
 */
export function PdButton({ variant, className, type = "button", ...rest }) {
  return (
    <button
      type={type}
      className={cn(
        "dk-button",
        variant && `dk-button-${variant}`,
        BUTTON_BASE,
        BUTTON_VARIANTS[variant] ?? BUTTON_VARIANTS.default,
        className,
      )}
      {...rest}
    />
  )
}

/** dashkit's Input slot: Birdy's pill input (36px), keeping `dk-input`. */
export function PdInput({ className, ...rest }) {
  return <Input className={cn("dk-input", className)} {...rest} />
}

// The native select's own arrow is removed (appearance-none) so it matches
// the pill input; this draws Birdy's chevron in its place. Inline, because a
// data URI is awkward as a Tailwind arbitrary value and an inline style is
// untouched by the stylesheet's revert-layer.
const CHEVRON = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#98989E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
)}")`

/**
 * dashkit's Select slot: a native `<select>` (keyboard and screen-reader
 * behaviour for free, and dashkit's forms read `e.target.value`) with the pd
 * input's chrome and a chevron.
 *
 * @param {{options: {value: string, label: string}[], className?: string} & React.SelectHTMLAttributes<HTMLSelectElement>} props
 */
export function PdSelect({ options, className, style, ...rest }) {
  return (
    <select
      className={cn(
        "dk-select h-9 w-full min-w-0 cursor-pointer appearance-none rounded-full border border-gray-300 bg-background py-1 pl-4 pr-9 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] duration-200 hover:border-gray-400 disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15",
        className,
      )}
      style={{
        backgroundImage: CHEVRON,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 12px center",
        backgroundSize: "14px",
        ...style,
      }}
      {...rest}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

/**
 * dashkit's Menu slot: Birdy's Radix dropdown (focus management, Escape,
 * outside click) instead of dashkit's `<details>` fallback.
 *
 * @param {{label: React.ReactNode, items: {label: string, onSelect: () => void, disabled?: boolean}[]}} props
 */
export function PdMenu({ label, items }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <PdButton variant="ghost">{label}</PdButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px] border-pd-border">
        {items.map((item, i) => (
          <DropdownMenuItem
            key={`${i}-${item.label}`}
            disabled={item.disabled}
            onSelect={item.onSelect}
            className="rounded-lg text-[13px] text-pd-ink"
          >
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * The icon names dashkit asks for (each widget's `def.icon` in the palette,
 * the canvas controls) plus the few Birdy's dashboard chrome uses, mapped to
 * lucide components. A static map rather than lucide's dynamic import: it is
 * a closed set, and the bundle should carry only these.
 */
const ICONS = {
  gauge: Gauge,
  "rows-3": Rows3,
  text: TextAlignStart,
  sparkles: Sparkles,
  "trending-up": TrendingUp,
  "bar-chart-3": ChartColumn,
  "pie-chart": ChartPie,
  "columns-2": Columns2,
  filter: Funnel,
  "list-ordered": ListOrdered,
  table: Table,
  "grip-vertical": GripVertical,
  minus: Minus,
  plus: Plus,
  "move-diagonal": MoveDiagonal,
  "plus-circle": CirclePlus,
  "layout-dashboard": LayoutDashboard,
  "undo-2": Undo2,
  "redo-2": Redo2,
}

/**
 * dashkit's Icon slot. Decorative: dashkit labels the buttons around it. An
 * unknown name renders nothing, as dashkit's own fallback does. Size comes
 * from `className` (default `size-4`).
 *
 * @param {{name: string, className?: string}} props
 */
export function PdIcon({ name, className }) {
  // hasOwn: a name like "constructor" must not reach Object.prototype.
  const Icon = Object.hasOwn(ICONS, name) ? ICONS[name] : null
  if (!Icon) return null
  return <Icon className={className ?? "size-4"} aria-hidden="true" />
}
