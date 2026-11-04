"use client"

import { Badge, Frame } from "@/components/ds"
import { money } from "@/lib/stock-agent-api"

/** A zone's badge tone and label, and its bar's colours (dark text on amber, which white can't be read on). */
export const ZONES = {
  green: { tone: "success", label: "Green", bar: "bg-success text-white" },
  yellow: { tone: "warning", label: "Yellow", bar: "bg-warning text-foreground" },
  red: { tone: "danger", label: "Red", bar: "bg-danger text-white" },
  no_data: { tone: "neutral", label: "No data", bar: "" },
}

const NO_DATA = "No data"

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

/** One currency at a time, worst first, so no two currencies are ever compared. No CPL goes last. */
function byCurrency(cards) {
  const groups = new Map()
  for (const card of cards) groups.set(card.currency, [...(groups.get(card.currency) ?? []), card])
  return [...groups.entries()].map(([currency, rows]) => ({
    currency,
    max: Math.max(0, ...rows.map((c) => c.current_cpl ?? 0)),
    rows: [...rows].sort((a, b) => (b.current_cpl ?? -1) - (a.current_cpl ?? -1)),
  }))
}

/** Cost per lead: a bar per client in its zone's colour, then the table. Each currency has its own scale. */
export function CplBars({ cards, alerts = [] }) {
  const groups = byCurrency(cards)
  const stopped = stoppedClients(cards, alerts)
  const rows = groups.flatMap((g) => g.rows)
  const hasLeads = cards.some((c) => c.leads != null)
  const hasAdsLive = cards.some((c) => c.ads_live != null)

  return (
    <Frame title="Cost per lead" description={groups.length > 1 ? "Each currency is scaled on its own." : undefined}>
      <div className="flex flex-col gap-2 p-4">
        {groups.flatMap((g) =>
          g.rows.map((card) => {
            const zone = ZONES[card.zone] ?? ZONES.no_data
            const text = money(card.current_cpl, card.currency)
            return (
              <div key={card.id} className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-2.5 text-sm sm:grid-cols-[150px_minmax(0,1fr)]">
                <span className="truncate">{card.client_name}</span>
                {text ? (
                  <div
                    data-zone-bar
                    className={`num flex h-[22px] min-w-12 items-center whitespace-nowrap rounded-control-sm px-2 text-xs font-semibold ${zone.bar || "bg-neutral-soft text-neutral-ink"}`}
                    style={{ width: `${g.max > 0 ? Math.round((card.current_cpl / g.max) * 100) : 0}%` }}
                  >
                    {text}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">{NO_DATA}</span>
                )}
              </div>
            )
          })
        )}
      </div>
      <div className="overflow-x-auto border-t">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-3.5 py-2.5 font-medium">Client</th>
              <th className="px-3.5 py-2.5 text-right font-medium">Last week</th>
              <th className="px-3.5 py-2.5 text-right font-medium">This week</th>
              <th className="px-3.5 py-2.5 text-right font-medium">Change</th>
              {hasLeads && <th className="px-3.5 py-2.5 text-right font-medium">Leads</th>}
              <th className="px-3.5 py-2.5 font-medium">Zone</th>
              {hasAdsLive && <th className="px-3.5 py-2.5 text-right font-medium">Ads live</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((card) => {
              const zone = ZONES[card.zone] ?? ZONES.no_data
              return (
                <tr key={card.id} className="border-b last:border-b-0">
                  <td className="px-3.5 py-2.5 font-medium">{card.client_name}</td>
                  <td className="num px-3.5 py-2.5 text-right">{money(card.previous_cpl, card.currency) ?? NO_DATA}</td>
                  <td className="num px-3.5 py-2.5 text-right">{money(card.current_cpl, card.currency) ?? NO_DATA}</td>
                  <td className="num px-3.5 py-2.5 text-right">{changeText(card.previous_cpl, card.current_cpl)}</td>
                  {hasLeads && <td className="num px-3.5 py-2.5 text-right">{card.leads ?? "n/a"}</td>}
                  <td className="px-3.5 py-2.5">
                    <span className="flex flex-wrap gap-1">
                      <Badge tone={zone.tone} size="sm">{zone.label}</Badge>
                      {stopped.has(card.client_group_id) && <Badge tone="danger" size="sm">Stopped</Badge>}
                    </span>
                  </td>
                  {hasAdsLive && <td className="num px-3.5 py-2.5 text-right">{card.ads_live ?? "n/a"}</td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Frame>
  )
}
