"use client";

// The Ads table with levels and drill-down. One implementation for both places it appears:
// Media Buyer's agency table (Clients · Campaigns · Ad sets · Ads · Leads) and inside one client
// (Campaigns · Ad sets · Ads · Leads). Clicking a row narrows the next level to it, down to the
// leads one ad brought in; the level and filters live in the address (see useDrill).

import { useMemo, useState } from "react";
import { Megaphone } from "lucide-react";
import { RowArrow, SearchField, TabPill, Table, TableBody, TableHead, Td, Th, Tr } from "@/components/by";
import { LeadsTable } from "./client-tables";
import { DrillTrail } from "./buyer-drill";
import { TableCard, money as moneyOf, tableState, useColumns } from "./table-card";
import { applyDrill, drillInto, drillTrail, filtersAt } from "@/lib/buyer-drill";
import { AD_LEVELS, AD_LEADS_LIMIT, searchBy, sortBy, toggleSort } from "@/lib/client-tables";

const LEVELS = {
  clients: { label: "Clients", noun: "Client" },
  ...Object.fromEntries(AD_LEVELS.map((l) => [l.key, { label: l.label, noun: l.noun }])),
  leads: { label: "Leads", noun: "Lead" },
};
const UNDER = { group: "this client", campaign: "this campaign", adset: "this ad set", ad: "this ad" };
const AD_COLUMNS = [{ id: "spend", label: "Spend" }, { id: "leads", label: "Leads" }, { id: "cpl", label: "CPL" }, { id: "inCrm", label: "In CRM" }, { id: "closed", label: "Closed" }];
const whole = (n) => Math.round(Number(n) || 0).toLocaleString("en-GB");

/** The note under a Leads level that hit the request's cap. */
export const adLeadsCapped = (fetched) => (fetched >= AD_LEADS_LIMIT ? `Showing the newest ${whole(AD_LEADS_LIMIT)} leads from these ads in this range; older ones are not listed.` : "");

/**
 * @param {ReturnType<import("./buyer-drill").useDrill>} props.nav the level and filters, from useDrill(scope)
 * @param {Record<string, object[]>} props.levels every level's rows, before the drill narrows them
 * @param {{loading: boolean, error: boolean, retry: () => void}} props.ads the state behind the ad levels
 * @param {{loading: boolean, error: boolean, retry: () => void, capped?: string}} props.leads the state behind the Leads level
 * @param {(key: string, id: string) => string} props.nameOf names the trail's chips
 * @param {boolean} [props.showClient] a Client column, for rows across the agency
 * @param {boolean} [props.columnsMenu] the menu that hides columns, where the toolbar has room
 * @param {React.ReactNode} [props.toolbarEnd] beside the search (the agency's client picker)
 * @param {(id: string) => void} [props.onOpenClient] the trail's way to a client's own page
 * @param {Record<string, {sort: object, render: Function}>} [props.custom] a level drawn by the caller (the agency's Clients)
 * @param {string} [props.adsOf] whose ads, for the empty Leads level
 */
export function AdsDrill({ nav, levels, ads, leads, nameOf, currencySymbol = "£", showClient = false, columnsMenu = false, toolbarEnd = null, onOpenClient, custom = {}, adsOf = "your ads" }) {
  const { scope, level, drill, go, setLevel, clear, step } = nav;
  const drilled = useMemo(() => Object.fromEntries(scope.levels.map((key) => [key, applyDrill(levels[key] ?? [], key, drill, scope)])), [levels, drill, scope]);
  const applied = useMemo(() => new Set(filtersAt(level, scope).map((f) => f.key)), [level, scope]);
  const trail = drillTrail(drill, nameOf, scope);

  const [query, setQuery] = useState("");
  const [sorts, setSorts] = useState({});
  const sort = sorts[level] ?? custom[level]?.sort ?? { id: "spend", dir: "desc" };
  const setSort = (next) => setSorts((all) => ({ ...all, [level]: typeof next === "function" ? next(sort) : next }));
  const header = (id, first) => ({ sort: sort?.id === id ? sort.dir : null, onSort: () => setSort((s) => toggleSort(s, id, first)) });
  const columns = useColumns(AD_COLUMNS);
  const money = moneyOf(currencySymbol);

  const spec = LEVELS[level];
  const plural = spec.label.toLowerCase();
  const all = drilled[level];
  const rows = useMemo(() => (level === "leads" ? all : sortBy(searchBy(all, query, ["name", "client", "campaign"]), sort)), [level, all, query, sort]);
  const counted = (key) => ((key === "leads" ? leads.loading : ads.loading) ? undefined : drilled[key].length);
  const drillRow = (row) => { const to = drillInto(level, row, scope); if (to) go(to.level, to.drill); };

  // The deepest filter this level uses names what the table is narrowed to.
  const deepest = [...trail].reverse().find((c) => applied.has(c.key));
  const empty = deepest
    ? { title: `No ${plural} under ${UNDER[deepest.key]} in this range`, body: "Remove a filter above to widen the table, or try a longer date range." }
    : level === "leads"
      ? { title: `No leads from ${adsOf} in this range`, body: "Leads appear here once an ad brings one in. Try a longer date range." }
      : { title: `No ${plural} ran in this range`, body: `${spec.label} appear here once they spend or bring in a lead. Try a longer date range.` };

  // At phone width the level switch scrolls sideways inside the card rather than being cut off.
  const levelSwitch = (
    <div className="max-w-full min-w-0 overflow-x-auto">
      <TabPill aria-label="Show by" value={level} onValueChange={setLevel} items={scope.levels.map((key) => ({ value: key, label: LEVELS[key].label, count: counted(key) }))} />
    </div>
  );
  const trailLine = <DrillTrail trail={trail} applied={applied} loading={ads.loading} onStep={step} onClear={clear} onOpenClient={onOpenClient} />;

  if (level === "leads") {
    return (
      <LeadsTable
        data={{ rows, total: null, loading: leads.loading, error: leads.error, retry: leads.retry, capped: leads.capped ?? "" }}
        currencySymbol={currencySymbol}
        showClient={showClient}
        stageTabs={false}
        calls={false}
        columnsMenu={columnsMenu}
        toolbarStart={levelSwitch}
        toolbarEnd={toolbarEnd}
        toolbarBelow={trailLine}
        empty={empty}
      />
    );
  }

  return (
    <TableCard
      toolbar={
        <>
          {levelSwitch}
          <div className="ml-auto flex max-w-full flex-wrap items-center gap-2.5">
            <SearchField className="w-56 max-w-full" placeholder={`Search ${plural}`} value={query} onChange={(e) => setQuery(e.target.value)} />
            {toolbarEnd}
            {columnsMenu && columns.menu}
          </div>
          {trailLine}
        </>
      }
      state={tableState({ data: { ...ads, rows: all }, shown: rows.length, noun: plural, icon: <Megaphone />, empty })}
    >
      {custom[level]?.render ? custom[level].render({ rows, header, drillRow }) : (
        <Table>
          <TableHead>
            <tr>
              <Th {...header("name", "asc")} className="min-w-56">{spec.noun}</Th>
              {showClient && <Th {...header("client", "asc")}>Client</Th>}
              {columns.shows("spend") && <Th numeric {...header("spend")}>Spend</Th>}
              {columns.shows("leads") && <Th numeric {...header("leads")}>Leads</Th>}
              {columns.shows("cpl") && <Th numeric {...header("cpl", "asc")}>CPL</Th>}
              {columns.shows("inCrm") && <Th numeric {...header("inCrm")}>In CRM</Th>}
              {columns.shows("closed") && <Th numeric {...header("closed")}>Closed</Th>}
              <Th aria-label="Open" className="w-9" />
            </tr>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <Tr key={row.id} interactive onClick={() => drillRow(row)}>
                <Td className="max-w-80 py-2.5">
                  <span className="block truncate" title={row.name}>{row.name}</span>
                  {row.campaign && <span className="block truncate text-by-caption text-by-muted" title={row.campaign}>{row.campaign}</span>}
                </Td>
                {showClient && <Td className="max-w-48 truncate text-by-text-2" title={row.client}>{row.client}</Td>}
                {columns.shows("spend") && <Td numeric>{money(row.spend, 2)}</Td>}
                {columns.shows("leads") && <Td numeric>{whole(row.leads)}</Td>}
                {columns.shows("cpl") && (
                  // A cost per lead over the client's limit is marked.
                  <Td numeric className={row.cpl != null && row.limit > 0 && row.cpl > row.limit ? "font-semibold text-by-danger" : ""}>{row.cpl == null ? "—" : money(row.cpl, 2)}</Td>
                )}
                {columns.shows("inCrm") && <Td numeric>{whole(row.inCrm)}</Td>}
                {columns.shows("closed") && <Td numeric>{whole(row.closed)}</Td>}
                <RowArrow />
              </Tr>
            ))}
          </TableBody>
        </Table>
      )}
    </TableCard>
  );
}
