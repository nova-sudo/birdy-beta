"use client";

import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, CircleDashed, GitBranch, Headset, Link2, ListFilter, Phone, Play, Users } from "lucide-react";
import {
  Button, Card, CountBadge, DropdownTrigger, EmptyState, Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger, Pill, RowArrow, SearchField, Table, TableBody, TableHead, Td, Th, Tr,
} from "@/components/by";
import { PageTabs } from "@/components/portfolio";
import { TableCard, money, tableState, useColumns } from "./table-card";
import { LeadModal } from "./lead/lead-modal";
import {
  LEAD_FILTERS, LEAD_STAGES, filterLeads, leadCounts, leadFilterOptions, lengthLabel, repRows, searchBy, sortBy, toggleSort, whenLabel,
} from "@/lib/client-tables";

const STAGE = {
  crm: { label: "In CRM", tone: "accent", icon: <Link2 /> },
  called: { label: "Called", tone: "warning", icon: <Phone /> },
  closed: { label: "Closed", tone: "success", icon: <Check /> },
  lost: { label: "Lost", tone: "neutral", icon: null },
  // Only ad-attributed leads have it: from an ad, never matched to the CRM.
  new: { label: "Not in CRM", tone: "neutral", icon: <CircleDashed /> },
};
// A CRM stage's pill takes its tone from how the lead's deal stands there.
const DEAL_TONE = { won: "success", lost: "neutral", abandoned: "neutral" };
const OUTCOME = { answered: { label: "Answered", tone: "success" }, none: { label: "No answer", tone: "neutral" } };


/**
 * The Leads table's filters in one menu: Source, Type, Opportunity and Tag.
 * Several values can be ticked in each; the menu stays open while choosing.
 */
export function LeadFilters({ options, chosen, onChange }) {
  const total = Object.values(chosen).reduce((n, list) => n + list.length, 0);
  const groups = LEAD_FILTERS.filter((f) => options[f.id]?.length);
  const toggle = (id, value) => {
    const list = chosen[id] ?? [];
    onChange({ ...chosen, [id]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] });
  };
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button aria-label={total ? `Filters, ${total} on` : "Filters"}><ListFilter aria-hidden="true" />Filters{total > 0 && <CountBadge>{total}</CountBadge>}</Button>
      </MenuTrigger>
      <MenuContent align="end" className="max-h-96 w-64 overflow-y-auto">
        {groups.length === 0 && <p className="px-2.5 py-2 text-by-body-sm text-by-muted">Nothing to filter by in this range.</p>}
        {groups.map((f, i) => (
          <div key={f.id} role="group" aria-label={f.label}>
            {i > 0 && <MenuSeparator />}
            <MenuLabel>{f.label}</MenuLabel>
            {options[f.id].map((value) => {
              const on = chosen[f.id]?.includes(value);
              return (
                <MenuItem
                  key={value}
                  role="menuitemcheckbox"
                  aria-checked={on}
                  selected={on}
                  // Keep the menu open: filters are usually set several at a time.
                  onSelect={(e) => { e.preventDefault(); toggle(f.id, value); }}
                >
                  <span className="min-w-0 flex-1 truncate capitalize" title={value}>{value}</span>
                  {on && <Check aria-hidden="true" />}
                </MenuItem>
              );
            })}
          </div>
        ))}
        {total > 0 && (
          <>
            <MenuSeparator />
            <MenuItem onSelect={() => onChange({})}>Clear all filters</MenuItem>
          </>
        )}
      </MenuContent>
    </Menu>
  );
}

// ── Leads ───────────────────────────────────────────────────────────────────

// A sheet: every lead a row, its stage and contact details first, then where it came from and what it is worth.
const LEAD_COLUMNS = [
  { id: "stage", label: "Stage" }, { id: "email", label: "Email" }, { id: "phone", label: "Phone" }, { id: "added", label: "Added" },
  { id: "from", label: "Came from" }, { id: "calls", label: "Calls" }, { id: "value", label: "Value" }, { id: "tags", label: "Tags" },
];
// Search reaches the contact details and tags too, whether or not their columns are shown.
const LEAD_SEARCH = ["name", "campaign", "ad", "source", "client", "email", "phone", "tagText", "stageName"];
const whole = (n) => Number(n || 0).toLocaleString("en-GB");

/**
 * The menu beside the stage tabs that picks which of the client's CRM pipelines they show.
 * @param {{id: string, name: string, total: number}[]} props.pipelines
 */
export function PipelinePicker({ pipelines, value, onChange }) {
  const current = pipelines.find((p) => p.id === value) ?? pipelines[0];
  return (
    <Menu>
      <MenuTrigger asChild>
        <DropdownTrigger className="rounded-full px-3.5" leading={<GitBranch aria-hidden="true" />} aria-label={`Pipeline: ${current.name}`}>
          <span className="max-w-48 truncate font-semibold">{current.name}</span>
        </DropdownTrigger>
      </MenuTrigger>
      <MenuContent align="start" className="max-h-80 w-64 overflow-y-auto">
        <MenuLabel>Pipeline</MenuLabel>
        {pipelines.map((p) => (
          <MenuItem key={p.id} selected={p.id === current.id} onSelect={() => onChange(p.id)}>
            <span className="min-w-0 flex-1 truncate" title={p.name}>{p.name}</span>
            <span className="shrink-0 text-by-caption text-by-muted tabular-nums">{whole(p.total)}</span>
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}

/**
 * A client's leads as a sheet: tabs by stage, search, and where each came from.
 * The Ads table reuses it for its Leads level, with its own controls around it.
 *
 * The stage tabs are the client's own CRM pipeline when `pipeline` is given: the server counts and
 * narrows them, so the rows arrive already in the picked stage. Without it they are Birdy's four
 * (In CRM, Called, Closed, Lost), counted from the rows loaded.
 *
 * @param {{rows: object[], total: number|null, loading: boolean, error: boolean, retry: () => void, capped?: string}} props.data
 * @param {boolean} [props.showClient] a Client column, for leads across the agency (rows carry `client`)
 * @param {boolean} [props.stageTabs] the stage tabs; off where the toolbar already has a level switch
 * @param {{tabs: {value: string, label: string, count?: number}[], value: string, onValueChange: (v: string) => void, picker?: React.ReactNode}} [props.pipeline]
 *   the CRM's stages as tabs (with "All" first), and the pipeline picker drawn beside them
 * @param {boolean} [props.calls] the Calls column; off when the rows don't say whether a lead was called
 * @param {boolean} [props.columnsMenu] the menu that hides columns; off where the toolbar has no room for it
 * @param {(row: object) => void} [props.onOpenLead] opens a lead somewhere else (its own page); left out, it opens over the table
 * @param {React.ReactNode} [props.toolbarStart] drawn first in the toolbar
 * @param {React.ReactNode} [props.toolbarEnd] drawn beside the search, before the filters
 * @param {React.ReactNode} [props.toolbarBelow] a full-width line under the toolbar's controls
 * @param {React.ReactNode} [props.footer] under the table in place of the capped note (a pager)
 * @param {{title: string, body: string}} [props.empty] what to say when there are no leads
 */
export function LeadsTable({ data, currencySymbol = "£", showClient = false, stageTabs = true, pipeline, calls = true, columnsMenu = true, onOpenLead, toolbarStart, toolbarEnd, toolbarBelow, footer, empty }) {
  const [tab, setTab] = useState("all");
  // The lead open in the modal over the table: {contactId, name}, or null.
  const [opened, setOpened] = useState(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState({ id: "added", dir: "desc" });
  const [filters, setFilters] = useState({});
  const columns = useColumns(calls ? LEAD_COLUMNS : LEAD_COLUMNS.filter((c) => c.id !== "calls"));
  const fmt = money(currencySymbol);
  // The CRM's stages are narrowed on the server; Birdy's own four here.
  const localTabs = stageTabs && !pipeline;

  const options = useMemo(() => leadFilterOptions(data.rows), [data.rows]);
  // The tab counts follow the filters, so a tab never promises rows the filters then hide.
  const filtered = useMemo(() => filterLeads(data.rows, filters), [data.rows, filters]);
  const counts = useMemo(() => leadCounts(filtered), [filtered]);
  const rows = useMemo(
    () => sortBy(searchBy(filtered.filter((r) => !localTabs || tab === "all" || r.stage === tab).map((r) => ({ ...r, tagText: (r.tags ?? []).join(" ") })), query, LEAD_SEARCH), sort),
    [filtered, localTabs, tab, query, sort],
  );
  const header = (id, first) => ({ sort: sort?.id === id ? sort.dir : null, onSort: () => setSort((s) => toggleSort(s, id, first)) });
  const contactOf = (row) => (row.contactId === undefined ? row.id : row.contactId);
  const open = (row) => {
    if (!contactOf(row)) return;
    if (onOpenLead) onOpenLead({ ...row, contactId: String(contactOf(row)) });
    else setOpened({ contactId: String(contactOf(row)), name: row.name });
  };
  const capped = data.capped || (data.total != null && data.total > data.rows.length ? `Showing the newest ${data.rows.length.toLocaleString("en-GB")} of ${data.total.toLocaleString("en-GB")} leads.` : "");
  const tabs = pipeline
    ? { items: pipeline.tabs, value: pipeline.value, onChange: pipeline.onValueChange }
    : { items: [{ value: "all", label: "All", count: counts.all }, ...LEAD_STAGES.map((st) => ({ value: st.key, label: st.label, count: counts[st.key] }))], value: tab, onChange: setTab };

  return (
    <>
    <TableCard
      toolbar={
        <>
          {toolbarStart}
          {pipeline?.picker}
          {stageTabs && (
            // At phone width, or with many stages, the tabs scroll sideways inside the card.
            <div className="max-w-full min-w-0 overflow-x-auto">
              <PageTabs
                label="Leads by stage"
                tabs={tabs.items.map((t) => ({ key: t.value, label: t.label, badge: t.count }))}
                value={tabs.value}
                onChange={tabs.onChange}
              />
            </div>
          )}
          <div className="ml-auto flex max-w-full flex-wrap items-center gap-2.5">
            <SearchField placeholder="Search leads" value={query} onChange={(e) => setQuery(e.target.value)} className={toolbarStart ? "w-44" : "w-52"} />
            {toolbarEnd}
            <LeadFilters options={options} chosen={filters} onChange={setFilters} />
            {columnsMenu && columns.menu}
          </div>
          {toolbarBelow}
        </>
      }
      state={tableState({ data, shown: rows.length, noun: "leads", icon: <Users />, empty: empty ?? { title: "No leads in this range", body: "Leads appear here once they reach the CRM. Try a longer date range." } })}
    >
      <Table>
        <TableHead>
          <tr>
            <Th {...header("name", "asc")} className="min-w-44">Name</Th>
            {showClient && <Th {...header("client", "asc")}>Client</Th>}
            {columns.shows("stage") && <Th {...(pipeline ? header("stageName", "asc") : {})}>Stage</Th>}
            {columns.shows("email") && <Th {...header("email", "asc")}>Email</Th>}
            {columns.shows("phone") && <Th>Phone</Th>}
            {columns.shows("added") && <Th {...header("added")}>Added</Th>}
            {columns.shows("from") && <Th>Came from</Th>}
            {columns.shows("calls") && <Th numeric {...header("calls")}>Calls</Th>}
            {columns.shows("value") && <Th numeric {...header("value")}>Value</Th>}
            {columns.shows("tags") && <Th>Tags</Th>}
            <Th aria-label="Open" className="w-9" />
          </tr>
        </TableHead>
        <TableBody>
          {rows.map((row) => {
            const stage = STAGE[row.stage] ?? STAGE.crm;
            const opens = Boolean(contactOf(row));
            return (
              <Tr key={row.id} interactive={opens} onClick={opens ? () => open(row) : undefined}>
                <Td className="max-w-64 truncate font-semibold" title={row.name}>
                  {opens ? (
                    // The keyboard's way in; a click anywhere on the row opens it too. Focus comes back here when the lead closes.
                    <button type="button" onClick={(e) => { e.stopPropagation(); open(row); }} className="max-w-full cursor-pointer truncate rounded-by-sm text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-by-accent">
                      {row.name}
                    </button>
                  ) : row.name}
                </Td>
                {showClient && <Td className={`max-w-48 truncate ${row.client ? "text-by-text-2" : "text-by-muted"}`} title={row.client}>{row.client || "—"}</Td>}
                {columns.shows("stage") && (
                  <Td>
                    {pipeline ? (
                      // The CRM's own stage name, as the pipeline tabs above call it.
                      row.stageName
                        ? <Pill tone={DEAL_TONE[row.dealStatus] ?? "accent"} className="max-w-56 truncate" title={row.pipelineName ? `${row.pipelineName} · ${row.stageName}` : row.stageName}>{row.stageName}</Pill>
                        : <span className="text-by-muted">No stage</span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Pill tone={stage.tone} dot={!stage.icon} className="[&_svg]:size-3">{stage.icon}{stage.label}</Pill>
                        {row.stageNote && <span className="truncate text-by-body-sm text-by-muted">{row.stageNote}</span>}
                      </span>
                    )}
                  </Td>
                )}
                {columns.shows("email") && <Td className={`max-w-56 truncate ${row.email ? "" : "text-by-muted"}`} title={row.email}>{row.email || "—"}</Td>}
                {columns.shows("phone") && <Td className={`whitespace-nowrap tabular-nums ${row.phone ? "" : "text-by-muted"}`}>{row.phone || "—"}</Td>}
                {columns.shows("added") && <Td className="whitespace-nowrap tabular-nums">{whenLabel(row.added)}</Td>}
                {columns.shows("from") && (
                  <Td className="max-w-80">
                    {row.campaign || row.ad ? (
                      <span className="flex min-w-0 items-center gap-1.5">
                        {row.campaign && <span className="min-w-0 truncate text-by-muted" title={row.campaign}>{row.campaign}</span>}
                        {row.campaign && row.ad && <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-by-line-strong" />}
                        {row.ad && <span className="min-w-0 truncate" title={row.ad}>{row.ad}</span>}
                      </span>
                    ) : <span className="text-by-muted">{row.source || "—"}</span>}
                  </Td>
                )}
                {columns.shows("calls") && <Td numeric className={row.calls ? "" : "text-by-muted"}>{row.calls || "None"}</Td>}
                {columns.shows("value") && <Td numeric className={row.value ? "" : "text-by-muted"}>{row.value ? fmt(row.value) : "—"}</Td>}
                {columns.shows("tags") && (
                  <Td className="max-w-64">
                    {row.tags?.length ? (
                      <span className="flex min-w-0 items-center gap-1 overflow-hidden" title={row.tags.join(", ")}>
                        {row.tags.slice(0, 2).map((t) => <Pill key={t} tone="neutral" dot={false} className="max-w-32 truncate">{t}</Pill>)}
                        {row.tags.length > 2 && <span className="shrink-0 text-by-caption text-by-muted">+{row.tags.length - 2}</span>}
                      </span>
                    ) : <span className="text-by-muted">—</span>}
                  </Td>
                )}
                {opens ? <RowArrow /> : <Td aria-hidden="true" className="w-9" />}
              </Tr>
            );
          })}
        </TableBody>
      </Table>
      {footer ?? (capped && <p className="border-t border-by-line-soft px-4.5 py-2.5 text-by-caption text-by-muted">{capped}</p>)}
    </TableCard>
    {/* Outside the card: a table that reloads under it never closes the lead. */}
    {!onOpenLead && <LeadModal contactId={opened?.contactId ?? null} name={opened?.name} onClose={() => setOpened(null)} />}
    </>
  );
}

/**
 * The line under a paged lead list: which leads are shown, and the way to the next and previous page.
 * @param {{page: number, pages: number, limit: number, total: number|null, shown: number, onPage: (page: number) => void}} props
 */
export function LeadPager({ page, pages, limit, total, shown, onPage }) {
  if (total == null || total === 0) return null;
  const from = (page - 1) * limit + 1;
  const to = (page - 1) * limit + shown;
  return (
    <div className="flex shrink-0 items-center gap-2.5 border-t border-by-line-soft px-4.5 py-2">
      <p className="mr-auto text-by-caption text-by-muted tabular-nums">
        {pages > 1 ? `Showing ${whole(from)} to ${whole(to)} of ${whole(total)} leads` : `${whole(total)} ${total === 1 ? "lead" : "leads"}`}
      </p>
      {pages > 1 && (
        <>
          <Button kind="ghost" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft aria-hidden="true" />Previous</Button>
          <span className="text-by-caption text-by-muted tabular-nums">Page {page} of {pages}</span>
          <Button kind="ghost" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">Next<ChevronRight aria-hidden="true" /></Button>
        </>
      )}
    </div>
  );
}

// ── Calls ───────────────────────────────────────────────────────────────────

const CALL_COLUMNS = [{ id: "caller", label: "Caller" }, { id: "outcome", label: "Outcome" }, { id: "when", label: "When" }, { id: "seconds", label: "Length" }, { id: "recording", label: "Recording" }];

/**
 * A client's calls, newest first, with each recording playable in place.
 * @param {boolean} [props.showClient] a Client column, for calls across the agency
 */
export function CallsTable({ data, showClient = false }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState({ id: "when", dir: "desc" });
  const [playing, setPlaying] = useState(null);
  const columns = useColumns(CALL_COLUMNS);
  const rows = useMemo(() => sortBy(searchBy(data.rows, query, ["name", "caller", "client"]), sort), [data.rows, query, sort]);
  const header = (id, first) => ({ sort: sort?.id === id ? sort.dir : null, onSort: () => setSort((s) => toggleSort(s, id, first)) });

  if (data.unavailable) {
    return <Card><EmptyState icon={<Phone />} title="No call centre connected">This client has no dialler linked, so there are no calls to list.</EmptyState></Card>;
  }
  return (
    <TableCard
      toolbar={<><SearchField placeholder="Search calls" value={query} onChange={(e) => setQuery(e.target.value)} className="w-60" />{columns.menu}</>}
      state={tableState({ data, shown: rows.length, noun: "calls", icon: <Phone />, empty: { title: "No calls in this range", body: "Calls appear here as the call centre makes them." } })}
    >
      <Table>
        <TableHead>
          <tr>
            <Th {...header("name", "asc")} className="min-w-44">Lead</Th>
            {showClient && <Th {...header("client", "asc")}>Client</Th>}
            {columns.shows("caller") && <Th {...header("caller", "asc")}>Caller</Th>}
            {columns.shows("outcome") && <Th>Outcome</Th>}
            {columns.shows("when") && <Th {...header("when")}>When</Th>}
            {columns.shows("seconds") && <Th numeric {...header("seconds")}>Length</Th>}
            {columns.shows("recording") && <Th>Recording</Th>}
          </tr>
        </TableHead>
        <TableBody>
          {rows.map((row) => {
            const outcome = OUTCOME[row.outcome];
            return (
              <Tr key={row.id}>
                <Td className="max-w-64 truncate font-semibold" title={row.name}>{row.name}</Td>
                {showClient && <Td className={`max-w-56 truncate ${row.client ? "" : "text-by-muted"}`} title={row.client}>{row.client || "—"}</Td>}
                {columns.shows("caller") && <Td className={row.caller ? "" : "text-by-muted"}>{row.caller || "—"}</Td>}
                {columns.shows("outcome") && <Td><Pill tone={outcome.tone}>{outcome.label}</Pill></Td>}
                {columns.shows("when") && <Td className="whitespace-nowrap tabular-nums">{whenLabel(row.when)}</Td>}
                {columns.shows("seconds") && <Td numeric>{lengthLabel(row.seconds)}</Td>}
                {columns.shows("recording") && (
                  <Td>
                    {!row.recording ? <span className="text-by-muted">—</span> : playing === row.id ? (
                      // eslint-disable-next-line jsx-a11y/media-has-caption -- a phone call has no caption track
                      <audio controls autoPlay src={row.recording} className="h-8 w-56" aria-label={`Recording of the call with ${row.name}`} />
                    ) : (
                      <Button kind="soft" size="sm" className="rounded-full" onClick={() => setPlaying(row.id)} aria-label={`Play the recording of the call with ${row.name}, ${lengthLabel(row.seconds)}`}>
                        <Play aria-hidden="true" />{lengthLabel(row.seconds)}
                      </Button>
                    )}
                  </Td>
                )}
              </Tr>
            );
          })}
        </TableBody>
      </Table>
      {data.capped && <p className="border-t border-by-line-soft px-4.5 py-2.5 text-by-caption text-by-muted">{data.capped}</p>}
    </TableCard>
  );
}

// ── Reps ────────────────────────────────────────────────────────────────────

const REP_COLUMNS = [{ id: "calls", label: "Calls" }, { id: "answered", label: "Answered" }, { id: "leads", label: "Leads called" }, { id: "talk", label: "Talk time" }, { id: "average", label: "Average call" }, { id: "last", label: "Last call" }];

/**
 * Who made the calls: one row per caller, counted from the same calls as the Calls table.
 * @param {{rows: object[], loading: boolean, error: boolean, retry: () => void, capped?: string}} props.data the calls, as the Calls table takes them
 */
export function RepsTable({ data }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState({ id: "calls", dir: "desc" });
  const columns = useColumns(REP_COLUMNS);
  const reps = useMemo(() => repRows(data.rows), [data.rows]);
  const rows = useMemo(() => sortBy(searchBy(reps, query, ["name"]), sort), [reps, query, sort]);
  const header = (id, first) => ({ sort: sort?.id === id ? sort.dir : null, onSort: () => setSort((s) => toggleSort(s, id, first)) });

  if (data.unavailable) {
    return <Card><EmptyState icon={<Headset />} title="No call centre connected">This client has no dialler linked, so there are no callers to list.</EmptyState></Card>;
  }
  return (
    <TableCard
      toolbar={<><SearchField placeholder="Search callers" value={query} onChange={(e) => setQuery(e.target.value)} className="w-60" />{columns.menu}</>}
      state={tableState({ data: { ...data, rows: reps }, shown: rows.length, noun: "callers", icon: <Headset />, empty: { title: "No calls in this range", body: "Callers appear here once the call centre makes calls." } })}
    >
      <Table>
        <TableHead>
          <tr>
            <Th {...header("name", "asc")} className="min-w-44">Caller</Th>
            {columns.shows("calls") && <Th numeric {...header("calls")}>Calls</Th>}
            {columns.shows("answered") && <Th numeric {...header("answerRate")}>Answered</Th>}
            {columns.shows("leads") && <Th numeric {...header("leads")}>Leads called</Th>}
            {columns.shows("talk") && <Th numeric {...header("talk")}>Talk time</Th>}
            {columns.shows("average") && <Th numeric {...header("average")}>Average call</Th>}
            {columns.shows("last") && <Th {...header("last")}>Last call</Th>}
          </tr>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <Tr key={row.id}>
              <Td className={`max-w-64 truncate font-semibold ${row.named ? "" : "text-by-muted"}`} title={row.name}>{row.name}</Td>
              {columns.shows("calls") && <Td numeric>{row.calls.toLocaleString("en-GB")}</Td>}
              {columns.shows("answered") && <Td numeric>{row.answered.toLocaleString("en-GB")}<span className="text-by-muted"> · {Math.round(row.answerRate)}%</span></Td>}
              {columns.shows("leads") && <Td numeric>{row.leads.toLocaleString("en-GB")}</Td>}
              {columns.shows("talk") && <Td numeric>{lengthLabel(row.talk)}</Td>}
              {columns.shows("average") && <Td numeric>{lengthLabel(row.average)}</Td>}
              {columns.shows("last") && <Td className="whitespace-nowrap tabular-nums">{whenLabel(row.last)}</Td>}
            </Tr>
          ))}
        </TableBody>
      </Table>
      {data.capped && <p className="border-t border-by-line-soft px-4.5 py-2.5 text-by-caption text-by-muted">{data.capped}</p>}
    </TableCard>
  );
}
