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
    // The CRM contact the row opens.
    contactId: contact.contactId,
    name: contact.contactName || "Unknown",
    stage,
    // What the CRM says about it, beside the stage: the pipeline stage's name where the CRM gives one.
    stageNote: opps.find((o) => o.pipelineStageName || o.stageName)?.pipelineStageName ?? opps.find((o) => o.stageName)?.stageName ?? "",
    campaign: meta.campaign_name || "",
    ad: meta.ad_name || "",
    source: contact.source || "",
    tags: Array.isArray(contact.tags) ? contact.tags.filter(Boolean).map(String) : [],
    type: contact.contactType || contact.type || "",
    // Every status among its deals: a lead with one open and one lost deal matches either filter.
    statuses: [...new Set(statuses.filter(Boolean))],
    added: contact.dateAdded || "",
    calls,
    value: opps.reduce((sum, o) => sum + num(o.monetaryValue ?? o.monetary_value), 0),
  };
}

/** How many leads sit in each stage, plus the total. */
export function leadCounts(rows) {
  const counts = { all: rows.length, crm: 0, called: 0, closed: 0, lost: 0 };
  for (const row of rows) counts[row.stage] = (counts[row.stage] ?? 0) + 1;
  return counts;
}

/** What `lead_source` on an ad-attributed lead means, in words. */
export const AD_LEAD_SOURCES = { instant_form: "Meta instant form", ghl_attribution: "CRM form", tracker: "Tracked form" };

/**
 * One row of the Leads table, from an ad-attributed lead of `/api/facebook-leads/filtered`
 * (the leads the Marketing Hub listed): the same shape as `leadRow`, plus the ad it came from.
 *
 * That endpoint does not say whether a lead was called, so `calls` is null rather than zero and
 * no lead is put in the Called stage. A lead the CRM never matched is `new`: from the ad, not in the CRM.
 * It only names the CRM contact for leads GoHighLevel itself attributed, so only those open one.
 */
export function adLeadRow(lead) {
  const status = String(lead.ghl_opportunity_status ?? "").toLowerCase();
  const stage = status === "won" ? "closed" : status === "lost" || status === "abandoned" ? "lost" : lead.ghl_matched ? "crm" : "new";
  return {
    id: String(lead.lead_id ?? ""),
    contactId: lead.lead_source === "ghl_attribution" && lead.lead_id ? String(lead.lead_id) : null,
    name: String(lead.full_name ?? "").trim() || "Unknown",
    stage,
    stageNote: "",
    campaign: lead.campaign_name || "",
    ad: lead.ad_name || "",
    source: AD_LEAD_SOURCES[lead.lead_source] ?? (lead.lead_source || ""),
    tags: Array.isArray(lead.ghl_tags) ? lead.ghl_tags.filter(Boolean).map(String) : [],
    type: "",
    statuses: status ? [status] : [],
    added: lead.created_time || lead.ghl_date_added || "",
    calls: null,
    value: num(lead.ghl_opportunity_value),
    groupId: String(lead.client_group_id ?? ""),
    campaignId: String(lead.campaign_id ?? ""),
    adsetId: String(lead.adset_id ?? ""),
    adId: String(lead.ad_id ?? ""),
  };
}

/** The four ways the Leads table can be narrowed, in menu order. Each lists the values present in the loaded leads. */
export const LEAD_FILTERS = [
  { id: "source", label: "Source", values: (row) => (row.source ? [row.source] : []) },
  { id: "type", label: "Type", values: (row) => (row.type ? [row.type] : []) },
  { id: "status", label: "Opportunity", values: (row) => row.statuses ?? [] },
  { id: "tag", label: "Tag", values: (row) => row.tags ?? [] },
];

/** For each filter, the values it can offer, A to Z. */
export function leadFilterOptions(rows) {
  const out = {};
  for (const f of LEAD_FILTERS) out[f.id] = [...new Set(rows.flatMap(f.values))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  return out;
}

/**
 * Leads matching every filter that has a choice; within one filter any chosen value will do.
 * @param {Record<string, string[]>} chosen filter id -> chosen values
 */
export function filterLeads(rows, chosen) {
  const active = LEAD_FILTERS.filter((f) => chosen?.[f.id]?.length);
  if (active.length === 0) return rows;
  return rows.filter((row) => active.every((f) => f.values(row).some((v) => chosen[f.id].includes(v))));
}

// ── Ads ─────────────────────────────────────────────────────────────────────

/** The three levels the Ads table can show. */
export const AD_LEVELS = [
  { key: "campaigns", label: "Campaigns", noun: "Campaign", list: "campaigns", rollup: "by_campaign" },
  { key: "adsets", label: "Ad sets", noun: "Ad set", list: "adsets", rollup: "by_adset" },
  { key: "ads", label: "Ads", noun: "Ad", list: "ads", rollup: "by_ad" },
];

/**
 * One row per campaign, ad set or ad that spent or brought a lead, from the
 * client's own Meta data and the CRM roll-up for that level (`/api/campaigns/opp-rollup`).
 * `parent` is what the row sits under: an ad set's or ad's campaign.
 *
 * @param {"campaigns"|"adsets"|"ads"} level
 */
export function adLevelRows(group, rollup = {}, level = "ads") {
  const spec = AD_LEVELS.find((l) => l.key === level) ?? AD_LEVELS[2];
  const fb = group?.facebook ?? {};
  const campaigns = new Map((fb.campaigns ?? []).map((c) => [String(c.id), c.name]));
  const crmBy = rollup?.[spec.rollup] ?? {};
  return (fb[spec.list] ?? [])
    .map((item) => {
      const spend = num(item.spend);
      const leads = num(item.results ?? item.leads);
      const crm = crmBy[item.id] ?? {};
      return {
        id: String(item.id),
        name: item.name || `Unnamed ${spec.noun.toLowerCase()}`,
        // What it sits under, by id, for narrowing one level to a row of the level above.
        campaignId: level === "campaigns" ? String(item.id) : String(item.campaign_id ?? ""),
        adsetId: level === "ads" ? String(item.adset_id ?? "") : level === "adsets" ? String(item.id) : "",
        parent: level === "campaigns" ? "" : campaigns.get(String(item.campaign_id)) ?? "",
        // Kept under its old name too: the search and older callers read `campaign`.
        campaign: level === "campaigns" ? "" : campaigns.get(String(item.campaign_id)) ?? "",
        spend,
        leads,
        cpl: leads > 0 ? spend / leads : null,
        inCrm: num(crm.contacts),
        closed: num(crm.won),
      };
    })
    .filter((row) => row.spend > 0 || row.leads > 0);
}

/** The ads level alone. `rollupByAd` is the roll-up's `by_ad`. */
export const adRows = (group, rollupByAd = {}) => adLevelRows(group, { by_ad: rollupByAd }, "ads");

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
          leadId: String(lead.id ?? name),
          // The client the lead belongs to; the dialler says "No Client Group" when it has none.
          client: lead.client_name && lead.client_name !== "No Client Group" ? lead.client_name : "",
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

/**
 * One row per caller, from the call rows above: how many calls they made, how many were answered,
 * how many leads they reached, their time on the phone and when they last called. Busiest first.
 */
export function repRows(calls) {
  const by = new Map();
  for (const c of calls ?? []) {
    const key = c.caller || "";
    const rep = by.get(key) ?? { id: key || "unnamed", name: key || "No caller name", named: Boolean(key), calls: 0, answered: 0, talk: 0, leadIds: new Set(), last: "" };
    rep.calls += 1;
    if (c.seconds > 0) rep.answered += 1;
    rep.talk += c.seconds || 0;
    rep.leadIds.add(c.leadId ?? c.name);
    if (String(c.when) > rep.last) rep.last = c.when;
    by.set(key, rep);
  }
  return [...by.values()]
    .map(({ leadIds, ...rep }) => ({ ...rep, leads: leadIds.size, answerRate: rep.calls ? (rep.answered / rep.calls) * 100 : 0, average: rep.answered ? rep.talk / rep.answered : 0 }))
    .sort((a, b) => b.calls - a.calls || a.name.localeCompare(b.name));
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
