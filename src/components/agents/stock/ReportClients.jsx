"use client"

import { useMemo, useState, useSyncExternalStore } from "react"

import { Badge, DataTable, Frame, Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ds"
import { cn } from "@/lib/utils"
import { alertBadge, plainError } from "./AlertsFrame"
import { CardPanel, cardStatus, cardWorking, linesNeedingYou } from "./CardPanel"
import { ZONES, changeText, count, cplText, spentNoLeads, stoppedClients, worstOrder } from "./cpl"

const AD_ISSUES = ["ad_with_issues", "ad_rejected", "ad_no_spend"]

const atRisk = (row) => row.stopped || row.alerts.some((a) => a.severity === "critical")
const notChecked = (row) => row.problems.length > 0 || row.alerts.some((a) => a.code === "check_failed")

const TILES = [
  { id: "all", label: "All clients", test: () => true },
  { id: "risk", label: "Spend at risk", test: atRisk, tone: "text-danger-ink" },
  { id: "red", label: "Red", test: (r) => r.card?.zone === "red", tone: "text-danger-ink" },
  { id: "changes", label: "Suggested changes", test: (r) => (r.card?.lines?.length ?? 0) > 0 },
  { id: "ads", label: "With ad issues", test: (r) => r.alerts.some((a) => AD_ISSUES.includes(a.code)) },
  { id: "unchecked", label: "Not checked", test: notChecked },
]

/** Worst first. Within a rank `worstOrder` stands, so two currencies are never compared. At risk follows the alerts, so the top row is who the answer box names. */
function rank(row) {
  if (atRisk(row)) return 0
  if (!row.card) return 7
  if ((row.card.lines?.length ?? 0) > 0) return 1
  if (spentNoLeads(row.card)) return 2
  return { red: 3, yellow: 4, no_data: 5, green: 6 }[row.card.zone] ?? 5
}

/**
 * A row per client the report has something to say about: every card, then any client with only an alert or a problem.
 * A client still being checked, or checked with nothing to say, isn't one.
 */
export function clientRows(cards, alerts, problems, nameOf) {
  const stopped = stoppedClients(cards, alerts)
  const row = (key, gid, name, card) => ({
    key,
    gid,
    name,
    card,
    stopped: stopped.has(gid),
    alerts: alerts.filter((a) => a.client_group_id === gid),
    problems: problems.filter((p) => p.gid === gid),
  })
  const carded = new Set(cards.map((c) => c.client_group_id))
  const others = [...new Set([...alerts.map((a) => a.client_group_id), ...problems.map((p) => p.gid)])].filter((gid) => gid && !carded.has(gid))
  const rows = [...worstOrder(cards).map((c) => row(c.id, c.client_group_id, c.client_name, c)), ...others.map((gid) => row(gid, gid, nameOf(gid), null))]
  const urgency = (r) => {
    const at = alerts.findIndex((a) => a.severity === "critical" && a.client_group_id === r.gid)
    return at < 0 ? alerts.length : at
  }
  return rows
    .map((r, i) => [r, i])
    .sort(([a, i], [b, j]) => rank(a) - rank(b) || (rank(a) === 0 ? urgency(a) - urgency(b) : 0) || i - j)
    .map(([r]) => r)
}

const NARROW_BELOW = 1200
const onResize = (fn) => {
  window.addEventListener("resize", fn)
  return () => window.removeEventListener("resize", fn)
}
/** Below this the table takes the page and a client's details open over it: a panel under 46 rows is too far to scroll. */
const useNarrow = () =>
  useSyncExternalStore(
    onResize,
    () => window.innerWidth < NARROW_BELOW,
    () => false
  )

function ZoneBadges({ row }) {
  if (!row.card) return <Badge tone="neutral" size="sm">Not checked</Badge>
  const zone = ZONES[row.card.zone] ?? ZONES.no_data
  return (
    <span className="flex flex-wrap gap-1">
      <Badge tone={zone.tone} size="sm">{zone.label}</Badge>
      {row.stopped && <Badge tone="danger" size="sm">Stopped</Badge>}
    </span>
  )
}

const None = () => <span className="text-xs text-muted-foreground">None</span>
const Num = ({ className, children }) => <span className={cn("num block text-right", className)}>{children}</span>

function Change({ card }) {
  if (!card) return <Num className="text-muted-foreground">–</Num>
  const text = changeText(card.previous_cpl, card.current_cpl)
  return <Num className={text.startsWith("+") ? "text-danger-ink" : text.startsWith("−") ? "text-success-ink" : "text-muted-foreground"}>{text}</Num>
}

function ProblemsCell({ row }) {
  const n = row.alerts.filter((a) => a.severity !== "info").length + row.problems.length
  if (n === 0) return <None />
  return <Badge tone={atRisk(row) ? "danger" : "warning"} size="sm">{n}</Badge>
}

function ChangesCell({ card, preview }) {
  if (!card) return <None />
  const needs = linesNeedingYou(card, preview)
  if (needs > 0) return <Badge tone="danger" size="sm">{needs} {needs === 1 ? "needs" : "need"} you</Badge>
  if (cardWorking(card)) return <Badge tone="info" size="sm">Working</Badge>
  const status = cardStatus(card)
  if (status) return <Badge tone={status.tone} size="sm">{status.short ?? status.text}</Badge>
  const n = card.lines?.length ?? 0
  return n > 0 ? <Badge tone="primary" size="sm">{n}</Badge> : <None />
}

function Problems({ row }) {
  const items = [
    ...row.alerts.map((a, i) => ({ key: `${a.code}-${i}`, title: a.title, detail: plainError(a.detail), ...alertBadge(a) })),
    ...row.problems,
  ]
  if (items.length === 0) return null
  return (
    <section className="flex flex-col gap-1.5">
      <h4 className="text-xs font-semibold text-muted-foreground">Problems</h4>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.key} className="flex flex-col items-start gap-1 rounded-control bg-frame px-3 py-2">
            <Badge tone={item.tone} size="sm">{item.label}</Badge>
            <p className="text-sm font-medium [overflow-wrap:anywhere]">{item.title}</p>
            {item.detail && <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{item.detail}</p>}
          </li>
        ))}
      </ul>
    </section>
  )
}

function Details({ row, actions, preview, disabled }) {
  return (
    <article aria-label={row.name}>
      {row.card ? (
        <CardPanel key={row.card.id} card={row.card} actions={actions} readOnly={preview} disabled={disabled} problems={<Problems row={row} />} />
      ) : (
        <Problems row={row} />
      )}
    </article>
  )
}

/**
 * The report's clients: tiles that filter a table, worst first, and the chosen client's details beside it.
 * Below 1200px the details open in a sheet from the row.
 */
export function ReportClients({ cards, alerts, problems, nameOf, actions, preview = false, disabled = false, description }) {
  const [filter, setFilter] = useState("all")
  const [chosen, setChosen] = useState(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const narrow = useNarrow()

  const rows = clientRows(cards, alerts, problems, nameOf)
  const tile = TILES.find((t) => t.id === filter)
  const shown = rows.filter(tile.test)
  // The panel always has a client on a wide screen, so a filter never leaves it describing a hidden row.
  const selected = shown.find((r) => r.key === chosen) ?? shown[0] ?? null

  const columns = useMemo(
    () => [
      { id: "client", header: "Client", enableSorting: false, cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
      { id: "zone", header: "Zone", enableSorting: false, cell: ({ row }) => <ZoneBadges row={row.original} /> },
      { id: "previous", header: "Last week", enableSorting: false, meta: { align: "right" }, cell: ({ row }) => <Num>{row.original.card ? cplText(row.original.card, "previous_cpl") : "–"}</Num> },
      { id: "current", header: "This week", enableSorting: false, meta: { align: "right" }, cell: ({ row }) => <Num>{row.original.card ? cplText(row.original.card) : "–"}</Num> },
      { id: "change", header: "Change", enableSorting: false, meta: { align: "right" }, cell: ({ row }) => <Change card={row.original.card} /> },
      { id: "leads", header: "Leads", enableSorting: false, meta: { align: "right" }, cell: ({ row }) => <Num>{count(row.original.card?.leads)}</Num> },
      { id: "problems", header: "Problems", enableSorting: false, cell: ({ row }) => <ProblemsCell row={row.original} /> },
      { id: "changes", header: "Changes", enableSorting: false, cell: ({ row }) => <ChangesCell card={row.original.card} preview={preview} /> },
    ],
    [preview]
  )

  if (rows.length === 0) return null

  const open = (row) => {
    setChosen(row.key)
    if (narrow) setSheetOpen(true)
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {TILES.map((t) => {
          const n = rows.filter(t.test).length
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={filter === t.id}
              onClick={() => setFilter(t.id)}
              className={cn(
                "min-w-0 rounded-control border bg-card px-3 py-2.5 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary",
                filter === t.id && "border-primary ring-1 ring-primary"
              )}
            >
              <span className={cn("num block text-xl font-semibold leading-tight", n > 0 && t.tone)}>{n}</span>
              <span className="block truncate text-xs text-muted-foreground">{t.label}</span>
            </button>
          )
        })}
      </div>

      <div className={cn("grid min-w-0 grid-cols-1 items-start gap-3", !narrow && "grid-cols-[minmax(0,1fr)_360px]")}>
        <Frame title="Clients" description={description} descriptionInline>
          <DataTable
            columns={columns}
            data={shown}
            dense
            paginate={false}
            stickyFirstColumn
            getRowId={(r) => r.key}
            onRowClick={open}
            selectedRowId={narrow ? undefined : selected?.key}
            empty={<p className="px-4 py-6 text-sm text-muted-foreground">No clients here.</p>}
          />
        </Frame>

        {!narrow && selected && (
          <div className="sticky top-4 max-h-[calc(100vh-6rem)] min-w-0 overflow-y-auto rounded-frame">
            <Frame title={selected.name} titleAs="h3" action={<ZoneBadges row={selected} />} padded>
              <Details row={selected} actions={actions} preview={preview} disabled={disabled} />
            </Frame>
          </div>
        )}
      </div>

      {narrow && (
        <Sheet open={sheetOpen && Boolean(selected)} onOpenChange={setSheetOpen}>
          <SheetContent>
            {selected && (
              <>
                <SheetHeader>
                  <SheetTitle>{selected.name}</SheetTitle>
                  <SheetDescription className="sr-only">This client&apos;s numbers and what Birdy suggests.</SheetDescription>
                </SheetHeader>
                <SheetBody className="flex flex-col gap-3">
                  <ZoneBadges row={selected} />
                  <Details row={selected} actions={actions} preview={preview} disabled={disabled} />
                </SheetBody>
              </>
            )}
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}
