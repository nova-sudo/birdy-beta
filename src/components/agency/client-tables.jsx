"use client";

import { useMemo, useState } from "react";
import { Check, ChevronRight, CircleDashed, Headset, Link2, ListFilter, Megaphone, Phone, Play, Users } from "lucide-react";
import {
  Button, Card, CountBadge, EmptyState, Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger, Pill, RowArrow, SearchField, TabPill, Table, TableBody, TableHead, Td, Th, Tr,
} from "@/components/by";
import { TableCard, money, tableState, useColumns } from "./table-card";
import { LeadModal } from "./lead/lead-modal";
import {
  AD_LEVELS, LEAD_FILTERS, LEAD_STAGES, filterLeads, leadCounts, leadFilterOptions, lengthLabel, repRows, searchBy, sortBy, toggleSort, whenLabel,
} from "@/lib/client-tables";

const STAGE = {
  crm: { label: "In CRM", tone: "accent", icon: <Link2 /> },
  called: { label: "Called", tone: "warning", icon: <Phone /> },
  closed: { label: "Closed", tone: "success", icon: <Check /> },
  lost: { label: "Lost", tone: "neutral", icon: null },
  // Only ad-attributed leads have it: from an ad, never matched to the CRM.
  new: { label: "Not in CRM", tone: "neutral", icon: <CircleDashed /> },
};
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

const LEAD_COLUMNS = [
  { id: "stage", label: "Stage" }, { id: "from", label: "Came from" }, { id: "added", label: "Added" }, { id: "calls", label: "Calls" }, { id: "value", label: "Value" },
];

/**
 * A client's leads: tabs by how far each got, search, and where each came from.
 * Media Buyer's agency table reuses it for its Leads level, with its own controls around it.
 *
 * @param {{rows: object[], total: number|null, loading: boolean, error: boolean, retry: () => void, capped?: string}} props.data
 * @param {boolean} [props.showClient] a Client column, for leads across the agency (rows carry `client`)
 * @param {boolean} [props.stageTabs] the stage tabs; off where the toolbar already has a level switch
 * @param {boolean} [props.calls] the Calls column; off when the rows don't say whether a lead was called
 * @param {boolean} [props.columnsMenu] the menu that hides columns; off where the toolbar has no room for it
 * @param {React.ReactNode} [props.toolbarStart] drawn first in the toolbar
 * @param {React.ReactNode} [props.toolbarEnd] drawn beside the search, before the filters
 * @param {React.ReactNode} [props.toolbarBelow] a full-width line under the toolbar's controls
 * @param {{title: string, body: string}} [props.empty] what to say when there are no leads
 */
export function LeadsTable({ data, currencySymbol = "£", showClient = false, stageTabs = true, calls = true, columnsMenu = true, toolbarStart, toolbarEnd, toolbarBelow, empty }) {
  const [tab, setTab] = useState("all");
  // The lead open in the modal over the table: {contactId, name}, or null.
  const [opened, setOpened] = useState(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState({ id: "added", dir: "desc" });
  const [filters, setFilters] = useState({});
  const columns = useColumns(calls ? LEAD_COLUMNS : LEAD_COLUMNS.filter((c) => c.id !== "calls"));
  const fmt = money(currencySymbol);

  const options = useMemo(() => leadFilterOptions(data.rows), [data.rows]);
  // The tab counts follow the filters, so a tab never promises rows the filters then hide.
  const filtered = useMemo(() => filterLeads(data.rows, filters), [data.rows, filters]);
  const counts = useMemo(() => leadCounts(filtered), [filtered]);
  const rows = useMemo(
    () => sortBy(searchBy(filtered.filter((r) => !stageTabs || tab === "all" || r.stage === tab), query, ["name", "campaign", "ad", "source", "client"]), sort),
    [filtered, stageTabs, tab, query, sort],
  );
  const header = (id, first) => ({ sort: sort?.id === id ? sort.dir : null, onSort: () => setSort((s) => toggleSort(s, id, first)) });
  const contactOf = (row) => (row.contactId === undefined ? row.id : row.contactId);
  const open = (row) => contactOf(row) && setOpened({ contactId: String(contactOf(row)), name: row.name });
  const capped = data.capped || (data.total != null && data.total > data.rows.length ? `Showing the newest ${data.rows.length.toLocaleString("en-GB")} of ${data.total.toLocaleString("en-GB")} leads.` : "");

  return (
    <>
    <TableCard
      toolbar={
        <>
          {toolbarStart}
          {stageTabs && (
            <TabPill
              aria-label="Leads by stage"
              value={tab}
              onValueChange={setTab}
              items={[{ value: "all", label: "All", count: counts.all }, ...LEAD_STAGES.map((s) => ({ value: s.key, label: s.label, count: counts[s.key] }))]}
            />
          )}
          <div className="ml-auto flex items-center gap-2.5">
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
            {columns.shows("stage") && <Th>Stage</Th>}
            {columns.shows("from") && <Th>Came from</Th>}
            {columns.shows("added") && <Th {...header("added")}>Added</Th>}
            {columns.shows("calls") && <Th numeric {...header("calls")}>Calls</Th>}
            {columns.shows("value") && <Th numeric {...header("value")}>Value</Th>}
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
                    <span className="flex items-center gap-2">
                      <Pill tone={stage.tone} dot={!stage.icon} className="[&_svg]:size-3">{stage.icon}{stage.label}</Pill>
                      {row.stageNote && <span className="truncate text-by-body-sm text-by-muted">{row.stageNote}</span>}
                    </span>
                  </Td>
                )}
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
                {columns.shows("added") && <Td className="whitespace-nowrap tabular-nums">{whenLabel(row.added)}</Td>}
                {columns.shows("calls") && <Td numeric className={row.calls ? "" : "text-by-muted"}>{row.calls || "None"}</Td>}
                {columns.shows("value") && <Td numeric className={row.value ? "" : "text-by-muted"}>{row.value ? fmt(row.value) : "—"}</Td>}
                {opens ? <RowArrow /> : <Td aria-hidden="true" className="w-9" />}
              </Tr>
            );
          })}
        </TableBody>
      </Table>
      {capped && <p className="border-t border-by-line-soft px-4.5 py-2.5 text-by-caption text-by-muted">{capped}</p>}
    </TableCard>
    {/* Outside the card: a table that reloads under it never closes the lead. */}
    <LeadModal contactId={opened?.contactId ?? null} name={opened?.name} onClose={() => setOpened(null)} />
    </>
  );
}

// ── Ads ─────────────────────────────────────────────────────────────────────

const AD_COLUMNS = [{ id: "spend", label: "Spend" }, { id: "leads", label: "Leads" }, { id: "cpl", label: "CPL" }, { id: "inCrm", label: "In CRM" }, { id: "closed", label: "Closed" }];

/**
 * A client's campaigns, ad sets or ads, with what each spent and brought in.
 * @param {{levels?: Record<string, object[]>, rows: object[]}} props.data `levels` holds the rows for each level; without it only ads are shown
 * @param {number|null} [props.cplTarget] a row over this cost per lead is marked
 */
export function AdsTable({ data, cplTarget = null, currencySymbol = "£", initialLevel = "ads" }) {
  const [level, setLevel] = useState(initialLevel);
  const spec = AD_LEVELS.find((l) => l.key === level);
  const levelRows = data.levels?.[level] ?? data.rows;
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState({ id: "spend", dir: "desc" });
  const columns = useColumns(AD_COLUMNS);
  const fmt = money(currencySymbol);
  const rows = useMemo(() => sortBy(searchBy(levelRows, query, ["name", "campaign"]), sort), [levelRows, query, sort]);
  const header = (id, first) => ({ sort: sort?.id === id ? sort.dir : null, onSort: () => setSort((s) => toggleSort(s, id, first)) });
  const plural = spec.label.toLowerCase();

  return (
    <TableCard
      toolbar={
        <>
          {data.levels && (
            <TabPill
              aria-label="Ad level"
              value={level}
              onValueChange={setLevel}
              items={AD_LEVELS.map((l) => ({ value: l.key, label: l.label, count: data.levels[l.key]?.length }))}
            />
          )}
          <div className={data.levels ? "ml-auto flex items-center gap-2.5" : "flex items-center gap-2.5"}>
            <SearchField placeholder={`Search ${plural}`} value={query} onChange={(e) => setQuery(e.target.value)} className="w-56" />
            {columns.menu}
          </div>
        </>
      }
      state={tableState({ data: { ...data, rows: levelRows }, shown: rows.length, noun: plural, icon: <Megaphone />, empty: { title: `No ${plural} ran in this range`, body: `${spec.label} appear here once they spend or bring in a lead.` } })}
    >
      <Table>
        <TableHead>
          <tr>
            <Th {...header("name", "asc")} className="min-w-56">{spec.noun}</Th>
            {columns.shows("spend") && <Th numeric {...header("spend")}>Spend</Th>}
            {columns.shows("leads") && <Th numeric {...header("leads")}>Leads</Th>}
            {columns.shows("cpl") && <Th numeric {...header("cpl")}>CPL</Th>}
            {columns.shows("inCrm") && <Th numeric {...header("inCrm")}>In CRM</Th>}
            {columns.shows("closed") && <Th numeric {...header("closed")}>Closed</Th>}
          </tr>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <Tr key={row.id}>
              <Td className="max-w-96 py-2.5">
                <span className="block truncate" title={row.name}>{row.name}</span>
                {row.campaign && <span className="block truncate text-by-caption text-by-muted" title={row.campaign}>{row.campaign}</span>}
              </Td>
              {columns.shows("spend") && <Td numeric>{fmt(row.spend, 2)}</Td>}
              {columns.shows("leads") && <Td numeric>{row.leads.toLocaleString("en-GB")}</Td>}
              {columns.shows("cpl") && (
                <Td numeric className={row.cpl != null && cplTarget > 0 && row.cpl > cplTarget ? "font-semibold text-by-danger" : ""}>{row.cpl == null ? "—" : fmt(row.cpl, 2)}</Td>
              )}
              {columns.shows("inCrm") && <Td numeric>{row.inCrm.toLocaleString("en-GB")}</Td>}
              {columns.shows("closed") && <Td numeric>{row.closed.toLocaleString("en-GB")}</Td>}
            </Tr>
          ))}
        </TableBody>
      </Table>
    </TableCard>
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
