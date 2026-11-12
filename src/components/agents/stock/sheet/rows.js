// The Media Buying sheet, as pure functions: which chip a client gets, its CPL zone, how the
// report moved, the line beside the tabs, and the rows in either order. No React here, so each
// rule is tested on its own (spec §2.1, §2.2).

import { openLines } from "@/lib/stock-agent-api"
import { linesNeedingYou } from "../CardPanel"

/** Alerts that mean the ads have stopped delivering. */
export const STOPPED_ALERTS = ["spend_stopped", "account_disabled"]
/** Alerts that mean the ads stop soon unless someone acts (billing, prepaid, review). */
export const SOON_ALERTS = ["payment_issue", "prepaid_low", "risk_review"]
/** Chips that count as "to decide": Birdy needs a person on these. */
export const DECIDE_CHIPS = ["stopped", "changes", "soon", "check"]
const DONE_STATUSES = ["applied", "partly_applied", "dismissed"]

const mineOf = (card, alerts) => {
  const all = (alerts ?? []).filter((a) => a && typeof a === "object")
  return card?.client_group_id ? all.filter((a) => !a.client_group_id || a.client_group_id === card.client_group_id) : all
}

/**
 * One client's Birdy chip, by the spec §2.2 table. `alerts` are the run's alerts (filtered to the
 * card's client here) or, with no card, that client's own alerts and problems.
 * @returns {{k: "stopped"|"changes"|"soon"|"check"|"done"|"none", n?: number, soon?: boolean}}
 */
export function birdyChip(card, alerts = []) {
  const mine = mineOf(card, alerts).filter((a) => a.client_group_id || !card)
  if (card?.decision === "spend_stopped" || mine.some((a) => STOPPED_ALERTS.includes(a.code))) return { k: "stopped" }
  const soon = mine.some((a) => SOON_ALERTS.includes(a.code))
  const n = card ? openLines(card).length : 0
  if (n > 0) return { k: "changes", n, soon }
  if (soon) return { k: "soon" }
  if (card && !card.has_newer && DONE_STATUSES.includes(card.status)) return { k: "done" }
  const flagged = card && !card.has_newer && card.status === "flagged" && (card.lines?.length ?? 0) > 0
  const stuck = card && linesNeedingYou(card) > 0
  const problem = mine.some((a) => a.severity !== "info")
  if (flagged || stuck || card?.ai_failed || problem) return { k: "check" }
  return { k: "none" }
}

export const isDecide = (chip) => DECIDE_CHIPS.includes(chip?.k)

/** A client's CPL limits from the agent's settings, the same rule as the backend's resolve_zones. Null when it has none. */
export function targetsFor(settings, gid, currency) {
  const own = settings?.clients?.[gid]?.zones
  const usable = (z) => (z && Number.isFinite(Number(z.green_under)) && Number.isFinite(Number(z.red_over)) && z.green_under != null && z.red_over != null
    ? { green_under: Number(z.green_under), red_over: Number(z.red_over) }
    : null)
  if (own && (own.green_under != null || own.red_over != null)) return usable(own)
  const def = settings?.zones
  if (def?.currency && currency && def.currency === currency) return usable(def)
  return null
}

/** A CPL's zone against the client's limits: green under the green line, red over the red line, grey with no CPL or no limits. */
export function zoneOf(cpl, targets) {
  if (cpl == null || !Number.isFinite(Number(cpl)) || !targets) return "gry"
  const c = Number(cpl)
  if (c < targets.green_under) return "grn"
  return c <= targets.red_over ? "amb" : "red"
}

const SERVER_ZONES = { green: "grn", yellow: "amb", red: "red", grn: "grn", amb: "amb" }
/** The server's zone word ("green", "yellow", "red", "no_data") as the sheet's. */
export const zoneWord = (zone) => SERVER_ZONES[zone] ?? "gry"

const RANK = { grn: 0, amb: 1, red: 2 }
const resolveTargets = (targets, card) => (typeof targets === "function" ? targets(card) : targets)

/** Who got better and who got worse: each card's last-week zone against this week's, on the client's own limits. */
export function moves(cards = [], targets = null) {
  const better = []
  const worse = []
  for (const card of cards) {
    const t = resolveTargets(targets, card)
    const was = zoneOf(card.previous_cpl, t)
    // Spend with no leads has no CPL and is red (checks.zone).
    const now = card.current_cpl == null && card.zone === "red" ? "red" : zoneOf(card.current_cpl, t)
    if (!(was in RANK) || !(now in RANK)) continue
    if (RANK[now] < RANK[was]) better.push(card.client_name)
    else if (RANK[now] > RANK[was]) worse.push(card.client_name)
  }
  return { better, worse }
}

/** The counts in the line beside the tabs: clients to decide, ads stopped, ads stopping soon. */
export function summary(cards = [], alerts = [], problems = []) {
  const live = (alerts ?? []).filter((a) => a && typeof a === "object")
  const gids = new Set([...cards.map((c) => c.client_group_id), ...live.map((a) => a.client_group_id), ...problems.map((p) => p.gid)].filter(Boolean))
  let toDecide = 0
  let stopped = 0
  let soon = 0
  for (const gid of gids) {
    const card = cards.find((c) => c.client_group_id === gid) ?? null
    const own = [...live.filter((a) => a.client_group_id === gid), ...problemAlerts(problems, gid)]
    const chip = birdyChip(card, own)
    if (isDecide(chip)) toDecide += 1
    if (chip.k === "stopped") stopped += 1
    else if (chip.k === "soon" || chip.soon) soon += 1
  }
  return { toDecide, stopped, soon }
}

/** Problems from the run (not checked, no card) count as a "Check" on the client. */
const problemAlerts = (problems, gid) => problems.filter((p) => p.gid === gid).map((p) => ({ client_group_id: gid, code: "problem", severity: "warning", title: p.title }))

const hasFigures = (row) => row.cpl != null || Number(row.spend) > 0

/**
 * The sheet's rows. A run view (`cards`) gives a row per card, then any client in scope with no card
 * in it; a month view (`monthRows`) gives the server's rows. A client with no card in what's on screen
 * opens on its latest card (`latestByClient[gid] = {card_id, run_id}`), read-only; with none it opens nothing.
 * @returns {Array<{gid, name, leads, cpl, spend, zone, chip, cardId, runId, readOnly, decided, currency, card, targets, noFigures}>}
 */
export function sheetRows({
  cards = [],
  monthRows = null,
  clientsInScope = [],
  latestByClient = {},
  alerts = [],
  problems = [],
  readOnly = false,
  targetsOf = () => null,
  currency = null,
} = {}) {
  const finish = (row) => ({ ...row, noFigures: !hasFigures(row) })
  if (monthRows) {
    return monthRows.map((r) => {
      const latest = latestByClient[r.client_group_id]
      const cur = r.currency ?? currency
      const targets = targetsOf(r.client_group_id, cur)
      return finish({
        gid: r.client_group_id,
        name: r.client_name,
        leads: r.leads ?? null,
        cpl: r.cpl ?? null,
        spend: r.spend ?? null,
        zone: r.zone ? zoneWord(r.zone) : zoneOf(r.cpl, targets),
        chip: { k: "none" },
        decided: r.decided ?? 0,
        cardId: latest?.card_id ?? null,
        runId: latest?.run_id ?? null,
        readOnly: true,
        currency: cur,
        card: null,
        targets,
      })
    })
  }
  const live = (alerts ?? []).filter((a) => a && typeof a === "object")
  const own = (gid) => [...live.filter((a) => a.client_group_id === gid), ...problemAlerts(problems, gid)]
  const carded = new Set(cards.map((c) => c.client_group_id))
  const rows = cards.map((card) =>
    finish({
      gid: card.client_group_id,
      name: card.client_name,
      leads: card.leads ?? null,
      cpl: card.current_cpl ?? null,
      spend: card.spend ?? null,
      prev: card.previous_cpl ?? null,
      zone: zoneWord(card.zone),
      chip: birdyChip(card, own(card.client_group_id)),
      decided: card.decided_at ? 1 : 0,
      cardId: card.id,
      runId: card.run_id ?? null,
      readOnly,
      currency: card.currency ?? currency,
      card,
      targets: targetsOf(card.client_group_id, card.currency ?? currency),
    })
  )
  const others = [...clientsInScope.map((c) => ({ gid: c.id, name: c.name })), ...problems.map((p) => ({ gid: p.gid, name: p.name }))]
  const seen = new Set(carded)
  for (const { gid, name } of others) {
    if (!gid || seen.has(gid)) continue
    seen.add(gid)
    const latest = latestByClient[gid]
    rows.push(
      finish({
        gid,
        name: name ?? clientsInScope.find((c) => c.id === gid)?.name ?? "A client",
        leads: null,
        cpl: null,
        spend: null,
        zone: "gry",
        chip: birdyChip(null, own(gid)),
        decided: 0,
        cardId: latest?.card_id ?? null,
        runId: latest?.run_id ?? null,
        readOnly: true,
        currency,
        card: null,
        targets: targetsOf(gid, currency),
      })
    )
  }
  return rows
}

const byName = (a, b) => String(a.name).localeCompare(String(b.name))
/** Spend with no leads ranks as the worst CPL. */
const cplKey = (row) => (row.cpl != null ? Number(row.cpl) : hasFigures(row) ? Infinity : null)
/** Ads already stopped first, then ads that stop soon, then changes, then anything else to check. */
const urgency = (row) => {
  if (row.chip.k === "stopped") return 0
  if (row.chip.soon || row.chip.k === "soon") return 1
  return row.chip.k === "changes" ? 2 : 3
}

/** Ranking columns: best first is the most leads, the lowest CPL, the most spend. */
export const SORTS = {
  leads: { label: "Leads", dir: -1, key: (r) => Number(r.leads ?? 0) },
  cpl: { label: "CPL", dir: 1, key: cplKey },
  spend: { label: "Ad spend", dir: -1, key: (r) => Number(r.spend ?? 0) },
}

/**
 * Rows in sheet order, each with its `rank` (null when not ranked).
 * - `urgent`: clients to decide first, worst first; then the rest by CPL rising; then no figures.
 * - otherwise ranked by `sort`; with `keepDecide` a no-figure client to decide sits right under the ranked ones.
 */
export function orderRows(rows, { mode = "urgent", sort = "cpl", keepDecide = true } = {}) {
  const none = rows.filter((r) => !hasFigures(r))
  const has = rows.filter(hasFigures)
  if (mode === "urgent") {
    const decide = rows
      .filter((r) => isDecide(r.chip))
      .sort((a, b) => urgency(a) - urgency(b) || (cplKey(b) ?? -1) - (cplKey(a) ?? -1) || byName(a, b))
    const rest = has.filter((r) => !isDecide(r.chip)).sort((a, b) => cplKey(a) - cplKey(b) || byName(a, b))
    const tail = none.filter((r) => !isDecide(r.chip)).sort(byName)
    return [...decide, ...rest, ...tail].map((r) => ({ ...r, rank: null }))
  }
  const col = SORTS[sort] ?? SORTS.cpl
  const ranked = [...has].sort((a, b) => {
    const x = col.key(a)
    const y = col.key(b)
    return (x === y ? 0 : x < y ? -1 : 1) * col.dir || byName(a, b)
  })
  const decideTail = keepDecide ? none.filter((r) => isDecide(r.chip)).sort(byName) : []
  const tail = none.filter((r) => !decideTail.includes(r)).sort(byName)
  return [...ranked.map((r, i) => ({ ...r, rank: i + 1 })), ...[...decideTail, ...tail].map((r) => ({ ...r, rank: null }))]
}

/** The newest card for each client across loaded runs (newest first): `{gid: {card_id, run_id}}`. */
export function latestCards(runs = []) {
  const out = {}
  for (const run of runs) {
    for (const [gid, c] of Object.entries(run?.clients ?? {})) {
      if (c?.card_id && !out[gid]) out[gid] = { card_id: c.card_id, run_id: run.id }
    }
  }
  return out
}

