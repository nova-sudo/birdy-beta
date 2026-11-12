"use client"

import { useMemo, useState } from "react"
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronUp, Clock } from "lucide-react"

import { Badge, Button, DataTable, SearchInput, SegmentedTabs, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ds"
import { cn } from "@/lib/utils"
import { money } from "@/lib/stock-agent-api"
import { SORTS, isDecide, orderRows } from "./rows"

/** Search shows from this many clients, as elsewhere. */
export const SEARCH_FROM = 10

const MODES = [
  { value: "urgent", label: "Most urgent" },
  { value: "best", label: "Best to worst" },
]
const ZONE_TONE = { grn: "success", amb: "warning", red: "danger", gry: "neutral" }
const ZONE_WORD = { grn: "Green", amb: "Yellow", red: "Red", gry: "No figures" }
const BEST = { leads: "most leads first", cpl: "lowest CPL first", spend: "most spend first" }

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const cash = (n, currency) => money(n, currency)

/** Which line the CPL sits under or over, in words. */
export function zoneTip(zone, targets, currency) {
  if (!targets) return zone === "gry" ? "No figures" : "This client has no CPL targets yet"
  const green = cash(targets.green_under, currency)
  const red = cash(targets.red_over, currency)
  if (zone === "grn") return `Under your ${green} green line`
  if (zone === "red") return `Over your ${red} red line`
  if (zone === "amb") return `Between your ${green} green and ${red} red lines`
  return "No figures"
}

function CplChip({ row }) {
  const text = row.cpl != null ? cash(row.cpl, row.currency) : "No leads"
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Badge size="sm" tone={ZONE_TONE[row.zone] ?? "neutral"} className="font-display">
            {text}
            <span className="sr-only"> {ZONE_WORD[row.zone]}</span>
          </Badge>
        </span>
      </TooltipTrigger>
      <TooltipContent>{zoneTip(row.zone, row.targets, row.currency)}</TooltipContent>
    </Tooltip>
  )
}

const Ring = () => <span aria-hidden className="size-2.5 shrink-0 rounded-full border-2 border-current" />

/** The Birdy column: one status chip from the card (spec §2.2). */
export function BirdyChip({ chip }) {
  switch (chip?.k) {
    case "stopped":
      return <Badge size="sm" tone="danger" mark={<Ring />}>Ads stopped</Badge>
    case "changes":
      return (
        <Badge size="sm" tone="primary" icon={chip.soon ? Clock : undefined}>
          {chip.soon && <span className="sr-only">Ads stop soon, </span>}
          {plural(chip.n, "change")}
        </Badge>
      )
    case "soon":
      return <Badge size="sm" tone="primary" icon={Clock}>Stops soon</Badge>
    case "check":
      return <Badge size="sm" tone="neutral">Check</Badge>
    case "done":
      return <Badge size="sm" tone="success" icon={Check}>Done</Badge>
    default:
      return <span role="img" aria-label="Nothing to decide" className="text-muted-foreground">—</span>
  }
}

const Num = ({ children, className }) => <span className={cn("block text-right font-display tabular-nums", className)}>{children}</span>

/**
 * The Media Buying sheet: every client on one table, with what Birdy wants from you in the last
 * column (spec §2.2). Today's report orders "Most urgent" or "Best to worst"; past runs and months
 * are always ranked. A row with a card opens Birdy's chat about that client.
 *
 * @param {object} props
 * @param {object[]} props.rows From `sheetRows`
 * @param {"today"|"past"|"month"} props.view
 * @param {(row: object) => void} props.onOpen
 */
export function ClientSheet({ rows, view, onOpen }) {
  const [mode, setMode] = useState("urgent")
  const [sort, setSort] = useState("cpl")
  const [query, setQuery] = useState("")
  const [showNone, setShowNone] = useState(false)

  const today = view === "today"
  // Only today's report has anything urgent, so a past one is always ranked.
  const ranked = !today || mode === "best"

  const ordered = useMemo(() => orderRows(rows, { mode: ranked ? "best" : "urgent", sort, keepDecide: today }), [rows, ranked, sort, today])
  const term = query.trim().toLowerCase()
  const found = term ? ordered.filter((r) => String(r.name).toLowerCase().includes(term)) : ordered
  // Clients with no figures stay out of the way until asked for, unless a search is looking for them, or Birdy needs you on them.
  const tucked = (r) => r.noFigures && !(today && isDecide(r.chip))
  const hidden = found.filter(tucked)
  const shown = useMemo(() => (showNone || term ? found : found.filter((r) => !tucked(r))), [found, showNone, term]) // eslint-disable-line react-hooks/exhaustive-deps

  const columns = useMemo(() => {
    const head = (key) => () => {
      const col = SORTS[key]
      const on = ranked && sort === key
      const Arrow = col.dir === 1 ? ArrowUp : ArrowDown
      return (
        <button
          type="button"
          aria-label={`Rank by ${col.label}: ${BEST[key]}`}
          aria-pressed={on}
          onClick={() => {
            setMode("best")
            setSort(key)
          }}
          className={cn(
            "inline-flex w-full cursor-pointer items-center justify-end gap-1 rounded-control-sm outline-none hover:text-foreground focus-visible:shadow-focus",
            on && "text-foreground"
          )}
        >
          <Arrow aria-hidden className="size-3.5" />
          {col.label}
        </button>
      )
    }
    const figure = (render) => ({ row }) => (row.original.noFigures ? null : render(row.original))
    return [
      ...(ranked
        ? [
            {
              id: "rank",
              header: () => <span className="sr-only">Rank</span>,
              enableSorting: false,
              meta: { label: "Rank", cardHidden: true },
              cell: ({ row }) => {
                const rank = row.original.rank
                if (!rank) return null
                const top = rank <= 3 && sort !== "spend"
                return (
                  <span className={cn("inline-flex size-6 items-center justify-center rounded-full font-display text-xs tabular-nums", top ? "bg-primary-soft font-semibold text-primary-ink" : "text-muted-foreground")}>
                    {rank}
                  </span>
                )
              },
            },
          ]
        : []),
      {
        id: "client",
        header: "Client",
        enableSorting: false,
        meta: { minWidth: 200 },
        cell: ({ row }) =>
          row.original.cardId ? (
            <button type="button" data-cell="client" aria-label={`${row.original.name}: open Birdy's chat`} className="cursor-pointer text-left font-medium outline-none hover:underline focus-visible:underline">
              {row.original.name}
            </button>
          ) : (
            <span data-cell="client" className="font-medium">{row.original.name}</span>
          ),
      },
      { id: "leads", header: head("leads"), enableSorting: false, meta: { align: "right", label: "Leads" }, cell: figure((r) => <Num>{r.leads == null ? "—" : Number(r.leads).toLocaleString("en-GB")}</Num>) },
      {
        id: "cpl",
        header: head("cpl"),
        enableSorting: false,
        meta: { align: "right", label: "CPL" },
        cell: figure((r) => (
          <span className="flex justify-end">
            <CplChip row={r} />
          </span>
        )),
      },
      {
        id: "spend",
        header: head("spend"),
        enableSorting: false,
        meta: { align: "right", label: "Ad spend" },
        cell: ({ row }) =>
          row.original.noFigures ? <Num className="text-muted-foreground">No figures</Num> : <Num>{cash(row.original.spend, row.original.currency) ?? "—"}</Num>,
      },
      {
        id: "birdy",
        header: "Birdy",
        enableSorting: false,
        meta: { label: "Birdy" },
        cell: ({ row }) =>
          today ? (
            <BirdyChip chip={row.original.chip} />
          ) : row.original.decided > 0 ? (
            <Badge size="sm" tone="success" icon={Check}>{row.original.decided} decided</Badge>
          ) : (
            <BirdyChip chip={{ k: "none" }} />
          ),
      },
    ]
  }, [ranked, sort, today])

  const toolbar = (
    <>
      {today && (
        <SegmentedTabs
          size="sm"
          ariaLabel="Order clients"
          value={mode}
          onValueChange={(m) => {
            setMode(m)
            if (m === "best") setSort("cpl")
          }}
          items={MODES}
        />
      )}
      {rows.length >= SEARCH_FROM && (
        // Wrapped, so the toolbar keeps it on the right rather than moving it to the left edge.
        <div className="ml-auto w-72 max-w-full">
          <SearchInput value={query} onChange={setQuery} debounceMs={0} size="sm" placeholder="Search clients" />
        </div>
      )}
    </>
  )

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <DataTable
        columns={columns}
        data={shown}
        dense
        paginate={false}
        toolbar={today || rows.length >= SEARCH_FROM ? toolbar : undefined}
        getRowId={(r) => r.gid}
        onRowClick={(r) => {
          if (r.cardId) onOpen(r)
        }}
        aria-label={ranked ? `Clients ranked by ${SORTS[sort].label}` : "Clients, most urgent first"}
        empty={<p className="px-4 py-6 text-sm text-muted-foreground">No clients in this report.</p>}
        emptyFiltered={<p className="px-4 py-6 text-sm text-muted-foreground">No clients match &ldquo;{query.trim()}&rdquo;.</p>}
      />
      {hidden.length > 0 && !term && (
        <Button variant="ghost" size="sm" className="w-fit text-muted-foreground" aria-expanded={showNone} onClick={() => setShowNone((v) => !v)}>
          {showNone ? "Hide" : "Show"} {plural(hidden.length, "client")} with no figures
          {showNone ? <ChevronUp aria-hidden /> : <ChevronDown aria-hidden />}
        </Button>
      )}
    </div>
  )
}
