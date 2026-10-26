"use client"

import * as React from "react"
import { Check, RotateCcw, X, Zap } from "lucide-react"

import { Badge, BADGE_TONE_TEXT, Button, DataTable, toast } from "@/components/ds"
import { undoAutoRun } from "@/lib/agents-api"
import { currencySymbol } from "@/lib/chat-viz"
import { cn } from "@/lib/utils"
import { DENY_REASONS } from "./DenyReason"

const DAY_MS = 86400000
// The outcomes job retries a row until it is 30 days old, then gives up on it.
const OUTCOME_GIVE_UP_DAYS = 30

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export const DECIDED = {
  auto: { tone: "primary", icon: Zap, label: "Auto-run" },
  approved: { tone: "success", icon: Check, label: "You approved" },
  denied: { tone: "danger", icon: X, label: "You denied" },
  undone: { tone: "warning", icon: RotateCcw, label: "You undid" },
}

/** "27 Oct 7:01" in the viewer's time. */
export function activityTime(at) {
  const d = new Date(at)
  if (Number.isNaN(d.getTime())) return ""
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`
}

/** Money in the row's own currency; no symbol at all when the currency is unknown. */
export function money(n, currency) {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return "–"
  const v = Number(n)
  const sym = currency ? currencySymbol(currency) : ""
  const whole = Math.abs(v) >= 100 || Number.isInteger(Math.round(v * 100) / 100)
  const text = whole
    ? Math.round(Math.abs(v)).toLocaleString("en-GB")
    : Math.abs(v).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${v < 0 ? "-" : ""}${sym}${text}`
}

/** What happened 7 days later, as `{text, tone}`; null when nothing was measured. */
export function outcomeText(outcome) {
  if (!outcome) return null
  if (outcome.metric === "account_cpl") {
    const { before, after, currency } = outcome
    if (before == null || after == null) return null
    const tone = after < before ? "success" : after > before ? "danger" : null
    return { text: `Account CPL ${money(before, currency)} → ${money(after, currency)}`, tone }
  }
  if (outcome.metric === "ad_cpl") {
    const { after, leads, spend, currency } = outcome
    if (after == null) return { text: `${money(spend, currency)} spent, no leads`, tone: null }
    return { text: `${leads} ${leads === 1 ? "lead" : "leads"} at ${money(after, currency)} CPL`, tone: null }
  }
  return null
}

const reasonLabel = (code) => DENY_REASONS.find((r) => r.code === code)?.label ?? null

/**
 * Marks apply rows that a later "undone" row reversed. Undo rows are newer, so they are on the
 * same page or an earlier one, and the newest-first list always has them before their apply.
 */
export function withUndone(items, undoneLocally = new Set()) {
  const undoneAt = new Map()
  for (const r of items) {
    if (r.decided === "undone" && r.suggestionId) {
      const prev = undoneAt.get(r.suggestionId)
      if (!prev || r.at > prev) undoneAt.set(r.suggestionId, r.at)
    }
  }
  return items.map((r) => {
    const applied = r.decided === "auto" || r.decided === "approved"
    const laterUndo = applied && r.suggestionId && undoneAt.get(r.suggestionId)
    const undone = Boolean(applied && ((laterUndo && laterUndo > r.at) || undoneLocally.has(r.id)))
    return { ...r, undone, canUndo: r.canUndo && !undone }
  })
}

function DecidedBadge({ decided }) {
  const d = DECIDED[decided] ?? DECIDED.approved
  return (
    <Badge tone={d.tone} size="sm" icon={d.icon}>
      {d.label}
    </Badge>
  )
}

function Outcome({ row }) {
  const muted = "text-muted-foreground"
  if (row.decided === "denied" || row.decided === "undone") {
    const why = row.note || reasonLabel(row.reasonCode)
    return <span className={muted}>{why ? `“${why}”` : "—"}</span>
  }
  const result = outcomeText(row.outcome)
  let fallback
  if (row.note) fallback = row.note
  else if (!row.actionType) fallback = "Nothing to measure"
  else if (Date.now() - new Date(row.at).getTime() > OUTCOME_GIVE_UP_DAYS * DAY_MS) fallback = "Not enough data"
  else fallback = "Too early"

  if (row.undone) {
    return (
      <span className={muted}>
        Undone{result ? ` · ${result.text}` : ""}
      </span>
    )
  }
  if (!result) return <span className={muted}>{fallback}</span>
  return <span className={cn(result.tone ? BADGE_TONE_TEXT[result.tone] : "text-foreground")}>{result.text}</span>
}

// Greys a cell's content on a row whose action was later undone.
const Dim = ({ row, children, className }) => (
  <span data-undone={row.undone ? "true" : undefined} className={cn(row.undone && "opacity-60", className)}>
    {children}
  </span>
)

/**
 * Every decision the agent's actions went through: when, what, for which client, who decided
 * (a badge per decision) and what happened 7 days later. Birdy's own actions carry Undo while
 * the server still allows it; an action undone later is greyed.
 *
 * @param {object} props
 * @param {string} props.agentId
 * @param {ReturnType<import("@/lib/agents-api").toActivityRow>[]} props.items Newest first
 * @param {boolean} [props.loading]
 * @param {() => void} [props.onChanged] After an undo (or a refused one), to re-read activity and impact
 */
export function ActivityTable({ agentId, items, loading = false, onChanged, className }) {
  const [busyId, setBusyId] = React.useState(null)
  const [undoneLocally, setUndoneLocally] = React.useState(() => new Set())

  const undo = async (row) => {
    setBusyId(row.id)
    try {
      await undoAutoRun(agentId, row.suggestionId)
      setUndoneLocally((prev) => new Set(prev).add(row.id))
      toast.success("Undone", { description: row.title })
    } catch (err) {
      if (err?.status === 410) {
        toast.error("Undo window closed", { description: "Auto-run actions can only be undone for 24 hours." })
      } else {
        toast.error("Couldn't undo that", { description: err?.message })
      }
    } finally {
      setBusyId(null)
      onChanged?.()
    }
  }
  const undoRef = React.useRef(undo)
  undoRef.current = undo

  const data = React.useMemo(
    () => withUndone(items ?? [], undoneLocally).map((r) => ({ ...r, busy: r.id === busyId })),
    [items, undoneLocally, busyId]
  )

  const columns = React.useMemo(
    () => [
      {
        accessorKey: "at",
        header: "Time",
        cell: ({ row: { original: r } }) => (
          <Dim row={r} className="font-mono text-xs text-muted-foreground">
            {activityTime(r.at)}
          </Dim>
        ),
      },
      {
        accessorKey: "title",
        header: "Action",
        cell: ({ row: { original: r } }) => (
          <Dim row={r} className="block max-w-[28rem] truncate">
            <span title={r.title}>{r.title}</span>
          </Dim>
        ),
      },
      {
        accessorKey: "client",
        header: "Client",
        cell: ({ row: { original: r } }) => (
          <Dim row={r} className="text-muted-foreground">
            {r.client ?? "—"}
          </Dim>
        ),
      },
      {
        accessorKey: "decided",
        header: "Decided by",
        cell: ({ row: { original: r } }) => (
          <Dim row={r}>
            <DecidedBadge decided={r.decided} />
          </Dim>
        ),
      },
      {
        id: "outcome",
        header: "7 days later",
        cell: ({ row: { original: r } }) => <Outcome row={r} />,
      },
      {
        id: "undo",
        header: () => <span className="sr-only">Undo</span>,
        meta: { label: "", align: "right" },
        cell: ({ row: { original: r } }) =>
          r.canUndo && r.suggestionId ? (
            <span className="flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                loading={r.busy}
                onClick={() => undoRef.current(r)}
                aria-label={`Undo ${r.title}`}
              >
                Undo
              </Button>
            </span>
          ) : null,
      },
    ],
    []
  )

  return (
    <DataTable
      className={className}
      columns={columns}
      data={data}
      loading={loading}
      getRowId={(r) => r.id}
      pageSize={25}
      pageSizeOptions={[25, 50, 100]}
      empty={
        <p className="text-center text-sm text-muted-foreground">
          Nothing yet. Every action, who decided it and what happened 7 days later will show here.
        </p>
      }
    />
  )
}
