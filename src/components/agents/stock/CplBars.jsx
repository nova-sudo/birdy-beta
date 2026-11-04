"use client"

import { useMemo } from "react"

import { Badge, DataTable, Frame } from "@/components/ds"
import { money } from "@/lib/stock-agent-api"

/** A zone's badge tone and label, and its bar's colours, each readable at 12px (dark text on amber; the deep red under white). */
export const ZONES = {
  green: { tone: "success", label: "Green", bar: "bg-success text-white" },
  yellow: { tone: "warning", label: "Yellow", bar: "bg-warning text-foreground" },
  red: { tone: "danger", label: "Red", bar: "bg-danger-ink text-white" },
  no_data: { tone: "neutral", label: "No data", bar: "" },
}

const NO_DATA = "No data"
const NO_LEADS = "No leads"
const NOT_STORED = "–"

/** Spend with no leads has no CPL but is red (checks.zone), and is as bad as a client can be. */
const spentNoLeads = (card) => card.current_cpl == null && card.zone === "red"

/** A card's CPL as words: its figure, else why it has none. */
export function cplText(card, field = "current_cpl") {
  return money(card[field], card.currency) ?? (field === "current_cpl" && spentNoLeads(card) ? NO_LEADS : NO_DATA)
}

/** The clients whose spend has stopped: their zone describes the week, not today. */
export function stoppedClients(cards, alerts) {
  return new Set([
    ...alerts.filter((a) => a.code === "spend_stopped").map((a) => a.client_group_id),
    ...cards.filter((c) => c.decision === "spend_stopped").map((c) => c.client_group_id),
  ])
}

function changeText(previous, current) {
  if (previous == null || current == null || !previous) return "n/a"
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0) return "0%"
  return `${pct > 0 ? "+" : "−"}${Math.abs(pct)}%`
}

const worstFirst = (card) => (spentNoLeads(card) ? Infinity : (card.current_cpl ?? -1))

/** One currency at a time, worst first, so no two currencies are ever compared. No CPL and no spend goes last. */
function byCurrency(cards) {
  const groups = new Map()
  for (const card of cards) groups.set(card.currency, [...(groups.get(card.currency) ?? []), card])
  return [...groups.entries()].map(([currency, rows]) => ({
    currency,
    max: Math.max(0, ...rows.map((c) => c.current_cpl ?? 0)),
    rows: [...rows].sort((a, b) => worstFirst(b) - worstFirst(a)),
  }))
}

const barWidth = (card, max) => {
  if (spentNoLeads(card)) return 100
  return max > 0 ? Math.round((card.current_cpl / max) * 100) : 0
}

const Num = ({ children }) => <span className="num block text-right">{children}</span>
const number = (id, header, cell) => ({ id, header, enableSorting: false, meta: { align: "right" }, cell: ({ row }) => <Num>{cell(row.original)}</Num> })
const count = (n) => (n == null ? NOT_STORED : Number(n).toLocaleString("en-GB"))

/** Cost per lead: a bar per client in its zone's colour, then the table. Each currency has its own scale. */
export function CplBars({ cards, alerts = [] }) {
  const groups = byCurrency(cards)
  const stopped = stoppedClients(cards, alerts)
  const rows = groups.flatMap((g) => g.rows)

  const columns = useMemo(
    () => [
      { id: "client", header: "Client", enableSorting: false, cell: ({ row }) => <span className="font-medium">{row.original.client_name}</span> },
      number("previous", "Last week", (c) => cplText(c, "previous_cpl")),
      number("current", "This week", (c) => cplText(c)),
      number("change", "Change", (c) => changeText(c.previous_cpl, c.current_cpl)),
      number("leads", "Leads", (c) => count(c.leads)),
      {
        id: "zone",
        header: "Zone",
        enableSorting: false,
        cell: ({ row }) => {
          const zone = ZONES[row.original.zone] ?? ZONES.no_data
          return (
            <span className="flex flex-wrap gap-1">
              <Badge tone={zone.tone} size="sm">{zone.label}</Badge>
              {stopped.has(row.original.client_group_id) && <Badge tone="danger" size="sm">Stopped</Badge>}
            </span>
          )
        },
      },
      number("ads_live", "Ads live", (c) => count(c.ads_live)),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `stopped` is rebuilt each render from these two
    [cards, alerts]
  )

  return (
    <Frame title="Cost per lead" description={groups.length > 1 ? "Each currency is scaled on its own." : undefined}>
      <div className="flex flex-col gap-2 p-4">
        {groups.flatMap((g) =>
          g.rows.map((card) => {
            const zone = ZONES[card.zone] ?? ZONES.no_data
            const hasBar = card.current_cpl != null || spentNoLeads(card)
            return (
              <div key={card.id} className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-2.5 text-sm sm:grid-cols-[150px_minmax(0,1fr)]">
                <span className="truncate">{card.client_name}</span>
                {hasBar ? (
                  <div
                    data-zone-bar
                    className={`num flex h-[22px] min-w-max items-center whitespace-nowrap rounded-control-sm px-2 text-xs font-semibold ${zone.bar || "bg-neutral-soft text-neutral-ink"}`}
                    style={{ width: `${barWidth(card, g.max)}%` }}
                  >
                    {cplText(card)}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">{NO_DATA}</span>
                )}
              </div>
            )
          })
        )}
      </div>
      <div className="border-t">
        <DataTable columns={columns} data={rows} paginate={false} getRowId={(c) => c.id} />
      </div>
    </Frame>
  )
}
