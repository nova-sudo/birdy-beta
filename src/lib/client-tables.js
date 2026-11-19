// Shaping for the three tables on a client's Dashboard tab: Leads, Ads, Calls.
// Plain functions over what the app's existing endpoints return.

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// ── Leads ───────────────────────────────────────────────────────────────────

/** The lead tabs, in funnel order. A lead sits in the furthest stage it reached; lost is its own bucket. */
export const LEAD_STAGES = [
  { key: "crm", label: "In CRM", tone: "accent" },
  { key: "called", label: "Called", tone: "warning" },
  { key: "closed", label: "Closed", tone: "success" },
  { key: "lost", label: "Lost", tone: "neutral" },
];

/** One row of the Leads table, from a contact of `/api/leads/unified`. */
export function leadRow(contact) {
  const opps = Array.isArray(contact.opportunities) ? contact.opportunities : [];
  const statuses = opps.map((o) => String(o.status ?? "").toLowerCase());
  const calls = num(contact.hp_enrichment?.call_logs_count);
  const won = statuses.includes("won");
  const lost = !won && statuses.length > 0 && statuses.every((s) => s === "lost" || s === "abandoned");
  const stage = won ? "closed" : lost ? "lost" : calls > 0 ? "called" : "crm";
  const meta = contact.meta_enrichment ?? {};
  return {
    id: contact.contactId,
    name: contact.contactName || "Unknown",
    stage,
    // What the CRM says about it, beside the stage: the pipeline stage's name where the CRM gives one.
    stageNote: opps.find((o) => o.pipelineStageName || o.stageName)?.pipelineStageName ?? opps.find((o) => o.stageName)?.stageName ?? "",
    campaign: meta.campaign_name || "",
    ad: meta.ad_name || "",
    source: contact.source || "",
    added: contact.dateAdded || "",
    calls,
    value: opps.reduce((sum, o) => sum + num(o.monetaryValue ?? o.monetary_value), 0),
  };
}

/** How many leads sit in each stage, plus the total. */
export function leadCounts(rows) {
  const counts = { all: rows.length, crm: 0, called: 0, closed: 0, lost: 0 };
  for (const row of rows) counts[row.stage] += 1;
  return counts;
}

// ── Ads ─────────────────────────────────────────────────────────────────────

/**
 * One row per ad that spent or brought a lead, from the client's own Meta data
 * and the per-ad CRM roll-up (`/api/campaigns/opp-rollup`).
 */
export function adRows(group, rollupByAd = {}) {
  const campaigns = new Map((group?.facebook?.campaigns ?? []).map((c) => [String(c.id), c.name]));
  return (group?.facebook?.ads ?? [])
    .map((ad) => {
      const spend = num(ad.spend);
      const leads = num(ad.results ?? ad.leads);
      const crm = rollupByAd[ad.id] ?? {};
      return {
        id: String(ad.id),
        name: ad.name || "Unnamed ad",
        campaign: campaigns.get(String(ad.campaign_id)) ?? "",
        spend,
        leads,
        cpl: leads > 0 ? spend / leads : null,
        inCrm: num(crm.contacts),
        closed: num(crm.won),
      };
    })
    .filter((ad) => ad.spend > 0 || ad.leads > 0);
}

// ── Calls ───────────────────────────────────────────────────────────────────

/** One row per call, newest first, from `/api/hotprospector/call-center` leads and their nested call logs. */
export function callRows(leads) {
  return (leads ?? [])
    .flatMap((lead) => {
      const name = `${lead.first_name || ""} ${lead.last_name || ""}`.trim() || lead.phone || lead.email || "Unknown";
      return (lead.call_logs ?? []).map((log, i) => {
        const seconds = num(log.duration);
        return {
          id: `${lead.id}-${log.call_time_iso ?? i}-${i}`,
          name,
          caller: log.caller_name || "",
          // The dialler records how long a call lasted, not how it ended: a call with talk time was answered.
          outcome: seconds > 0 ? "answered" : "none",
          direction: log.call_status === "outbound" ? "Outbound" : "Inbound",
          when: log.call_time_iso || "",
          seconds,
          recording: log.recording_url || "",
        };
      });
    })
    .sort((a, b) => String(b.when).localeCompare(String(a.when)));
}

// ── Shared ──────────────────────────────────────────────────────────────────

/** "4 Nov · 18:31" */
export function whenLabel(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
}

/** Seconds as "6:52"; a dash for a call with no talk time. */
export const lengthLabel = (seconds) => (seconds > 0 ? `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}` : "—");

/** Rows where any of the named text fields contains the search, ignoring case. */
export function searchBy(rows, query, fields) {
  const q = query.trim().toLowerCase();
  return q ? rows.filter((row) => fields.some((f) => String(row[f] ?? "").toLowerCase().includes(q))) : rows;
}

/** Rows ordered by one column. Text sorts alphabetically, everything else as numbers; blanks go last. */
export function sortBy(rows, sort) {
  if (!sort) return rows;
  const sign = sort.dir === "asc" ? 1 : -1;
  const blank = (v) => v == null || v === "";
  return rows.slice().sort((a, b) => {
    const x = a[sort.id];
    const y = b[sort.id];
    if (blank(x) || blank(y)) return blank(x) ? (blank(y) ? 0 : 1) : -1;
    return sign * (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y)));
  });
}

/** The sort after a header is pressed: first press as given, second press reversed. */
export const toggleSort = (sort, id, first = "desc") => (sort?.id === id ? { id, dir: sort.dir === "asc" ? "desc" : "asc" } : { id, dir: first });
