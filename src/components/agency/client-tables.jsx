"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Link2, Megaphone, Phone, Play, SearchX, Users } from "lucide-react";
import {
  Button, Card, ColumnsMenu, EmptyState, Notice, Pill, RowArrow, SearchField, Skeleton, TabPill, Table, TableBody, TableHead, TableScroll, Td, Th, Tr,
} from "@/components/by";
import { LEAD_STAGES, leadCounts, lengthLabel, searchBy, sortBy, toggleSort, whenLabel } from "@/lib/client-tables";

const STAGE = {
  crm: { label: "In CRM", tone: "accent", icon: <Link2 /> },
  called: { label: "Called", tone: "warning", icon: <Phone /> },
  closed: { label: "Closed", tone: "success", icon: <Check /> },
  lost: { label: "Lost", tone: "neutral", icon: null },
};
const OUTCOME = { answered: { label: "Answered", tone: "success" }, none: { label: "No answer", tone: "neutral" } };

/** The card every client table sits in: a toolbar that stays put, and the table scrolling under it. */
function TableCard({ toolbar, state, children }) {
  return (
    <Card className="flex min-h-0 flex-col overflow-hidden motion-safe:animate-[by-enter_var(--by-dur-base)_var(--by-ease-out)]">
      <div className="flex shrink-0 flex-wrap items-center gap-2.5 border-b border-by-line px-4.5 py-3.5">{toolbar}</div>
      {state ?? <TableScroll className="rounded-none border-0 shadow-none">{children}</TableScroll>}
    </Card>
  );
}

/** What a table shows instead of rows: loading, a failure, or nothing to list. */
function tableState({ data, shown, noun, empty, icon }) {
  if (data.error) {
    return <div className="p-4"><Notice tone="danger" action={<Button size="sm" onClick={data.retry}>Retry</Button>}>Couldn’t load {noun}. Check your connection and try again.</Notice></div>;
  }
  if (data.loading) {
    return (
      <div aria-busy="true" aria-label={`Loading ${noun}`} className="flex flex-col gap-4 p-5">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="w-full" />)}
      </div>
    );
  }
  if (data.rows.length === 0) return <EmptyState icon={icon} title={empty.title}>{empty.body}</EmptyState>;
  if (shown === 0) return <EmptyState icon={<SearchX />} title={`No ${noun} match`}>Try a different search or tab.</EmptyState>;
  return null;
}

/** Which of a table's optional columns are shown, with the menu that changes them. */
function useColumns(all) {
  const [ids, setIds] = useState(() => all.map((c) => c.id));
  const menu = <ColumnsMenu columns={all} value={ids} onChange={setIds} />;
  return { shows: (id) => ids.includes(id), menu };
}

const money = (symbol) => (n, decimals = 0) => `${symbol}${Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;

// ── Leads ───────────────────────────────────────────────────────────────────

const LEAD_COLUMNS = [
  { id: "stage", label: "Stage" }, { id: "from", label: "Came from" }, { id: "added", label: "Added" }, { id: "calls", label: "Calls" }, { id: "value", label: "Value" },
];

/**
 * A client's leads: tabs by how far each got, search, and where each came from.
 * @param {{rows: object[], total: number|null, loading: boolean, error: boolean, retry: () => void}} props.data
 */
export function LeadsTable({ data, currencySymbol = "£" }) {
  const router = useRouter();
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState({ id: "added", dir: "desc" });
  const columns = useColumns(LEAD_COLUMNS);
  const fmt = money(currencySymbol);

  const counts = useMemo(() => leadCounts(data.rows), [data.rows]);
  const rows = useMemo(
    () => sortBy(searchBy(data.rows.filter((r) => tab === "all" || r.stage === tab), query, ["name", "campaign", "ad", "source"]), sort),
    [data.rows, tab, query, sort],
  );
  const header = (id, first) => ({ sort: sort?.id === id ? sort.dir : null, onSort: () => setSort((s) => toggleSort(s, id, first)) });
  const open = (row) => row.id && router.push(`/contacts/${encodeURIComponent(row.id)}`);
  const capped = data.total != null && data.total > data.rows.length;

  return (
    <TableCard
      toolbar={
        <>
          <TabPill
            aria-label="Leads by stage"
            value={tab}
            onValueChange={setTab}
            items={[{ value: "all", label: "All", count: counts.all }, ...LEAD_STAGES.map((s) => ({ value: s.key, label: s.label, count: counts[s.key] }))]}
          />
          <div className="ml-auto flex items-center gap-2.5">
            <SearchField placeholder="Search leads" value={query} onChange={(e) => setQuery(e.target.value)} className="w-56" />
            {columns.menu}
          </div>
        </>
      }
      state={tableState({ data, shown: rows.length, noun: "leads", icon: <Users />, empty: { title: "No leads in this range", body: "Leads appear here once they reach the CRM. Try a longer date range." } })}
    >
      <Table>
        <TableHead>
          <tr>
            <Th {...header("name", "asc")} className="min-w-44">Name</Th>
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
            const stage = STAGE[row.stage];
            return (
              <Tr key={row.id} interactive onClick={() => open(row)}>
                <Td className="max-w-64 truncate font-semibold" title={row.name}>{row.name}</Td>
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
                <RowArrow />
              </Tr>
            );
          })}
        </TableBody>
      </Table>
      {capped && <p className="border-t border-by-line-soft px-4.5 py-2.5 text-by-caption text-by-muted">Showing the newest {data.rows.length.toLocaleString("en-GB")} of {data.total.toLocaleString("en-GB")} leads.</p>}
    </TableCard>
  );
}

// ── Ads ─────────────────────────────────────────────────────────────────────

const AD_COLUMNS = [{ id: "spend", label: "Spend" }, { id: "leads", label: "Leads" }, { id: "cpl", label: "CPL" }, { id: "inCrm", label: "In CRM" }, { id: "closed", label: "Closed" }];

/**
 * A client's ads, with what each spent and brought in.
 * @param {number|null} [props.cplTarget] an ad over this cost per lead is marked
 */
export function AdsTable({ data, cplTarget = null, currencySymbol = "£" }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState({ id: "spend", dir: "desc" });
  const columns = useColumns(AD_COLUMNS);
  const fmt = money(currencySymbol);
  const rows = useMemo(() => sortBy(searchBy(data.rows, query, ["name", "campaign"]), sort), [data.rows, query, sort]);
  const header = (id, first) => ({ sort: sort?.id === id ? sort.dir : null, onSort: () => setSort((s) => toggleSort(s, id, first)) });

  return (
    <TableCard
      toolbar={<><SearchField placeholder="Search ads" value={query} onChange={(e) => setQuery(e.target.value)} className="w-60" />{columns.menu}</>}
      state={tableState({ data, shown: rows.length, noun: "ads", icon: <Megaphone />, empty: { title: "No ads ran in this range", body: "Ads appear here once they spend or bring in a lead." } })}
    >
      <Table>
        <TableHead>
          <tr>
            <Th {...header("name", "asc")} className="min-w-56">Ad</Th>
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

/** A client's calls, newest first, with each recording playable in place. */
export function CallsTable({ data }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState({ id: "when", dir: "desc" });
  const [playing, setPlaying] = useState(null);
  const columns = useColumns(CALL_COLUMNS);
  const rows = useMemo(() => sortBy(searchBy(data.rows, query, ["name", "caller"]), sort), [data.rows, query, sort]);
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
    </TableCard>
  );
}
