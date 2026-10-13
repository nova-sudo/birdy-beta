// Helpers behind the Slack report message editor
// (components/report-designer/ReportEditor). The report is a free-form Slack
// message; live numbers go in as {{placeholders}} the server fills at send
// time (birdy-backend/services/report_template.py). The server is the
// authority on what's valid; these only build and insert placeholders.

const needsQuotes = (v) => /[\s,"]/.test(String(v))

/** {{name key=value key="value with spaces"}} — empty options are left out. */
export function buildPlaceholder(name, opts = {}) {
  const parts = Object.entries(opts)
    .filter(([, v]) => v !== undefined && v !== null && v !== "" && v !== false)
    .map(([k, v]) => `${k}=${needsQuotes(v) ? `"${String(v).replace(/"/g, "'")}"` : v}`)
  return `{{${[name, ...parts].join(" ")}}}`
}

/** Placeholders that produce several lines read best starting on a fresh line. */
export function isMultiline(name, opts = {}) {
  if (name === "breakdown") return true
  if (name === "ranking") return Number(opts.limit || 3) > 1
  if (name === "alerts" || name === "flagged_ads") return opts.show === "list"
  return false
}

/** Insert `snippet` over the selection [start, end); returns the new text and caret. */
export function insertAt(text, start, end, snippet) {
  const before = text.slice(0, start)
  const after = text.slice(end)
  const next = before + snippet + after
  return { text: next, cursor: before.length + snippet.length }
}

/** Wrap the selection in a Slack mrkdwn marker (*bold*, _italic_, ~strike~, `code`). */
export function wrapSelection(text, start, end, marker) {
  const selected = text.slice(start, end) || "text"
  const snippet = `${marker}${selected}${marker}`
  const out = insertAt(text, start, end, snippet)
  return { text: out.text, selStart: start + marker.length, selEnd: start + marker.length + selected.length }
}

/** Start each selected line with a prefix ("• ", "> ", "# "). */
export function prefixLines(text, start, end, prefix) {
  const lineStart = text.lastIndexOf("\n", start - 1) + 1
  const lineEnd = end > start ? end : (text.indexOf("\n", start) === -1 ? text.length : text.indexOf("\n", start))
  const block = text.slice(lineStart, lineEnd)
  const changed = block.split("\n").map((l) => (l.startsWith(prefix) ? l : prefix + l)).join("\n")
  return { text: text.slice(0, lineStart) + changed + text.slice(lineEnd), cursor: lineStart + changed.length }
}

/** The placeholders in a message, for listing what live numbers it carries. */
export function placeholdersIn(body = "") {
  return [...String(body).matchAll(/\{\{\s*([a-z_]+)[^}]*\}\}/g)].map((m) => ({ raw: m[0], name: m[1] }))
}

// ── Block Kit editing ─────────────────────────────────────────────────────────

/** Pretty JSON for the editor. */
export function toJson(blocks) {
  return JSON.stringify(blocks ?? [], null, 2)
}

/** The editor's text as blocks, or a readable error (with the line) when it isn't valid JSON. */
export function parseBlocks(text) {
  try {
    const value = JSON.parse(text)
    if (!Array.isArray(value)) return { blocks: [], error: "The report must be a JSON array of blocks: [ {...}, {...} ]" }
    return { blocks: value, error: null }
  } catch (e) {
    const at = /position (\d+)/.exec(e.message)
    const line = at ? String(text).slice(0, Number(at[1])).split("\n").length : null
    return { blocks: [], error: `The JSON isn't valid${line ? ` near line ${line}` : ""}: ${e.message.replace(/^JSON\.parse: /, "")}` }
  }
}

const md = (text) => ({ type: "mrkdwn", text })

/** "Add block" menu: every block a channel message allows, wired to live data where it makes sense. */
export const BLOCK_TEMPLATES = [
  { group: "Text", items: [
    { id: "header", label: "Header", hint: "Big bold title", block: () => ({ type: "header", text: { type: "plain_text", text: "Weekly numbers · {{period}}" } }) },
    { id: "section", label: "Text", hint: "A paragraph with live numbers", block: () => ({ type: "section", text: md("We spent *{{spend}}* for *{{leads}}* leads ({{spend show=change}}).") }) },
    { id: "fields", label: "Two-column numbers", hint: "A tidy grid of headline figures", block: () => ({ type: "section", fields: [
      md("*Ad spend*\n{{spend}}"), md("*Leads*\n{{leads}}"), md("*Cost per lead*\n{{cpl}}"), md("*Deals won*\n{{ghl_won_opps}}"),
    ] }) },
    { id: "markdown", label: "Markdown", hint: "Standard Markdown, tables included", block: () => ({ type: "markdown", text: "**Top clients**\n{{ranking metric=leads order=best limit=3}}" }) },
    { id: "rich_text", label: "Rich text list", hint: "Slack's structured bullets", block: () => ({ type: "rich_text", elements: [{ type: "rich_text_list", style: "bullet", elements: [
      { type: "rich_text_section", elements: [{ type: "text", text: "Spend: {{spend}}" }] },
      { type: "rich_text_section", elements: [{ type: "text", text: "Leads: {{leads}}" }] },
    ] }] }) },
    { id: "context", label: "Small print", hint: "Grey footnote line", block: () => ({ type: "context", elements: [md("🔔 Alerts: {{alerts}} · {{client_count}} clients")] }) },
    { id: "divider", label: "Divider", hint: "A line between parts", block: () => ({ type: "divider" }) },
  ] },
  { group: "Charts (native Slack, max 2)", items: [
    { id: "bar", chart: true, label: "Bar chart by client", hint: "Compare clients on one or more metrics", block: () => ({ type: "data_visualization", title: "Spend and leads by client", birdy_data: { chart: "bar", by: "client", metrics: ["spend", "leads"], limit: 8 } }) },
    { id: "line", chart: true, label: "Line chart by day", hint: "Daily trend over the last days", block: () => ({ type: "data_visualization", title: "Daily spend", birdy_data: { chart: "line", by: "day", metrics: ["spend"], days: 14 } }) },
    { id: "area", chart: true, label: "Area chart per client", hint: "One layer per client over days", block: () => ({ type: "data_visualization", title: "Daily spend by client", birdy_data: { chart: "area", by: "day", metrics: ["spend"], days: 14, split: "client" } }) },
    { id: "pie", chart: true, label: "Pie chart", hint: "Each client's share of a total", block: () => ({ type: "data_visualization", title: "Share of spend", birdy_data: { chart: "pie", by: "client", metrics: ["spend"] } }) },
  ] },
  { group: "Tables and cards", items: [
    { id: "data_table", label: "Data table of clients", hint: "Sortable, paginated", block: () => ({ type: "data_table", caption: "Clients", page_size: 10, birdy_data: { metrics: ["spend", "leads", "cpl"], sort: "spend", total_row: true } }) },
    { id: "table", label: "Simple table", hint: "A fixed grid of clients", block: () => ({ type: "table", birdy_data: { metrics: ["spend", "leads"], limit: 5 } }) },
    { id: "carousel", label: "Card per client", hint: "A swipeable carousel", block: () => ({ type: "carousel", birdy_data: { metrics: ["spend", "leads"], limit: 5 } }) },
    { id: "card", label: "Card", hint: "A highlighted tile", block: () => ({ type: "card", title: md("*This week*"), body: md("{{spend}} spent · {{leads}} leads"),
      actions: [{ type: "button", text: { type: "plain_text", text: "Open Birdy" }, url: "https://birdy-beta.vercel.app/dashboard" }] }) },
  ] },
  { group: "Links and media", items: [
    { id: "actions", label: "Link buttons", hint: "Open Birdy pages", block: () => ({ type: "actions", elements: [
      { type: "button", text: { type: "plain_text", text: "Open dashboard" }, url: "https://birdy-beta.vercel.app/dashboard", style: "primary" },
    ] }) },
    { id: "image", label: "Image", hint: "Any https image", block: () => ({ type: "image", image_url: "https://birdy-beta.vercel.app/icon.png", alt_text: "Birdy" }) },
  ] },
]
