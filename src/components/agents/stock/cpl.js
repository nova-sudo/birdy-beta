import { money } from "@/lib/stock-agent-api"

/** A zone's badge tone and label. */
export const ZONES = {
  green: { tone: "success", label: "Green" },
  yellow: { tone: "warning", label: "Yellow" },
  red: { tone: "danger", label: "Red" },
  no_data: { tone: "neutral", label: "No data" },
}

const NO_DATA = "No data"
const NO_LEADS = "No leads"
const NOT_STORED = "–"

export const count = (n) => (n == null ? NOT_STORED : Number(n).toLocaleString("en-GB"))

/** Spend with no leads has no CPL but is red (checks.zone), and is as bad as a client can be. */
export const spentNoLeads = (card) => card.current_cpl == null && card.zone === "red"

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

export function changeText(previous, current) {
  if (previous == null || current == null || !previous) return "n/a"
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0) return "0%"
  return `${pct > 0 ? "+" : "−"}${Math.abs(pct)}%`
}

const worstFirst = (card) => (spentNoLeads(card) ? Infinity : (card.current_cpl ?? -1))

/** One currency at a time, worst first, so no two currencies are ever compared. No CPL and no spend goes last. */
export function worstOrder(cards) {
  const groups = new Map()
  for (const card of cards) groups.set(card.currency, [...(groups.get(card.currency) ?? []), card])
  return [...groups.values()].flatMap((rows) => [...rows].sort((a, b) => worstFirst(b) - worstFirst(a)))
}

/**
 * The client who most needs attention, by the report's own order: spend with no leads above all, in any currency, then
 * the first red or stopped client. Two currencies are never compared, so a higher figure only wins within its own.
 */
export function worstClient(cards, stopped) {
  const order = worstOrder(cards)
  return order.find(spentNoLeads) ?? order.find((c) => c.zone === "red" || stopped.has(c.client_group_id)) ?? null
}
