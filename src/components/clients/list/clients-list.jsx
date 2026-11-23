"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, ChevronDown, Files, Plus, SearchX, Tag, Users } from "lucide-react";
import getSymbolFromCurrency from "currency-symbol-map";
import {
  Button, Card, ColumnsMenu, DropdownTrigger, EmptyState, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Notice, Pill,
  RowArrow, SearchField, Skeleton, TabPanel, TabPill, Table, TableBody, TableHead, TableScroll, Td, Th, Tr,
} from "@/components/by";
import { clientHref } from "@/components/shell/nav";
import { useClientActions } from "@/components/shell/client-actions";
import { apiRequest } from "@/lib/api";
import { isAwaitingFirstData } from "@/lib/client-loading";
import { flattenClientGroup } from "@/lib/client-rows";
import {
  COLUMN_LABELS, DEFAULT_COLUMNS, FIXED_COLUMNS, TABS, formatCell, groupColumns, inTab, lastSynced, nextSort, overTarget, readState, savedViews,
  searchRows, sortRows, statusOf, tabCounts, writeState,
} from "@/lib/clients-list";
import { DATE_PRESETS, DEFAULT_DATE_PRESET, STORAGE_KEYS } from "@/lib/constants";
import { buildDynamicColumns } from "@/lib/enhanced-columns-config";
import { useClientGroups } from "@/lib/useClientGroups";
import { useColumnViews } from "@/lib/useColumnViews";

const RANGES = DATE_PRESETS.map((p) => p.value);
const URL_OPTIONS = { ranges: RANGES, defaultRange: DEFAULT_DATE_PRESET };
const PILL = { danger: ["danger", "At risk"], warning: ["warning", "At risk"], ok: ["success", "On track"] };
/** "Last 7 Days" -> "Last 7 days": the app's shared labels are title case; this page writes in sentence case. */
const sentence = (label) => label.charAt(0) + label.slice(1).toLowerCase();
const EMPTY_TAB = { all: "No active clients", risk: "No clients at risk", ok: "No clients on track", off: "No inactive clients" };

/** The agency's custom formula metrics that are switched on for the Clients list. */
function useCustomMetrics() {
  const [metrics, setMetrics] = useState([]);
  useEffect(() => {
    let live = true;
    apiRequest("/api/custom-metrics")
      .then(async (res) => {
        if (!res.ok || !live) return;
        const data = await res.json();
        setMetrics(
          (data.custom_metrics || [])
            .filter((m) => (m.dashboards || []).includes("clients"))
            .map((m) => ({ id: m.id, name: m.name, formulaParts: m.formula_parts || [], formatType: m.format_type || "integer" })),
        );
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return metrics;
}

/** The account's currency symbol, from the stored preference. */
function useCurrencySymbol() {
  const [symbol, setSymbol] = useState("$");
  useEffect(() => {
    try {
      setSymbol(getSymbolFromCurrency(localStorage.getItem(STORAGE_KEYS.DEFAULT_CURRENCY) || "USD") || "$");
    } catch {
      // Keep the default.
    }
  }, []);
  return symbol;
}

/**
 * Every client: tabs by status, sort, search, columns, and the two ways of adding more.
 *
 * Birdy's Dashboard tab shows this same table under its own header:
 * @param {(range: {datePreset: string, rangeLabel: string, setDatePreset: (value: string) => void, dateMenu: React.ReactNode}) => React.ReactNode} [props.header]
 *   replaces the "Clients" header; it is handed the date range and a ready-made date menu
 * @param {React.ReactNode} [props.footer] sits under the table and stays in place, e.g. an ask bar
 * @param {string} [props.viewKey] which saved column view this table reads and writes
 */
export function ClientsList({ header, footer, viewKey = "clients" } = {}) {
  const router = useRouter();
  const { openAddClient, openImport } = useClientActions();
  const { clientGroups, loading, error, refresh, datePreset, setDatePreset } = useClientGroups(DEFAULT_DATE_PRESET, { includeDaily: false });
  const customMetrics = useCustomMetrics();
  const currencySymbol = useCurrencySymbol();
  const { savedColumns, saveView, viewsLoaded } = useColumnViews(viewKey);

  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(null);
  const [ready, setReady] = useState(false);
  // null until the user changes the columns here; then their working set.
  const [columnIds, setColumnIds] = useState(null);
  // While the Columns panel is open the table makes room beside it, so a column just added is never under the panel.
  const [columnsOpen, setColumnsOpen] = useState(false);

  // The list's state lives in the address, so coming back from a client
  // returns to the same tab, search, sort and date range.
  useEffect(() => {
    const state = readState(window.location.search, URL_OPTIONS);
    setTab(state.tab);
    setQuery(state.q);
    setSort(state.sort);
    if (state.range !== datePreset) setDatePreset(state.range);
    setReady(true);
    // Read once on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!ready) return;
    const next = `${window.location.pathname}${writeState({ tab, q: query, sort, range: datePreset }, URL_OPTIONS)}`;
    if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", next);
  }, [ready, tab, query, sort, datePreset]);

  // Every column the list can show: today's catalogue plus custom formulas.
  const catalogue = useMemo(() => {
    const built = buildDynamicColumns(clientGroups).filter((c) => !FIXED_COLUMNS.has(c.id));
    const custom = customMetrics.map((m) => ({ id: m.id, label: m.name, category: "formulas" }));
    const seen = new Set();
    return [...built, ...custom]
      .filter((c) => !seen.has(c.id) && seen.add(c.id))
      // A tag column is named by the tag alone and marked with a tag icon, in the panel and in its header.
      .map((c) => (c.type === "tag"
        ? { ...c, label: String(c.label ?? c.tagName ?? c.id).replace(/^Tag:\s*/i, ""), icon: <Tag aria-hidden="true" /> }
        : { ...c, label: COLUMN_LABELS[c.id] ?? c.label ?? c.id }));
  }, [clientGroups, customMetrics]);
  const known = useMemo(() => new Map(catalogue.map((c) => [c.id, c])), [catalogue]);
  const range = DATE_PRESETS.find((p) => p.value === datePreset) ?? DATE_PRESETS.find((p) => p.value === DEFAULT_DATE_PRESET);
  const rangeLabel = sentence(range.label);
  const grouped = useMemo(() => groupColumns(catalogue, rangeLabel), [catalogue, rangeLabel]);

  // What is shown: the working set, else the saved view, else the defaults.
  const saved = Array.isArray(savedColumns) ? savedColumns.filter((id) => !FIXED_COLUMNS.has(id)) : null;
  const shownIds = (columnIds ?? (saved?.length ? saved : DEFAULT_COLUMNS)).filter((id) => known.has(id) || DEFAULT_COLUMNS.includes(id));
  const columns = shownIds.map((id) => known.get(id) ?? { id, label: COLUMN_LABELS[id] ?? id });

  const rows = useMemo(
    () =>
      clientGroups.map((group) => ({
        ...flattenClientGroup(group, { columns: catalogue, customMetrics, enhanced: true }),
        listStatus: statusOf(group),
        syncing: group.status === "pending" || group.status === "creating" || isAwaitingFirstData(group),
        cplTarget: group.targets?.cpl ?? null,
      })),
    [clientGroups, catalogue, customMetrics],
  );
  const counts = useMemo(() => tabCounts(rows), [rows]);
  const visible = sortRows(searchRows(rows.filter((row) => inTab(row.listStatus, tab)), query), sort);
  const synced = lastSynced(clientGroups);
  const sortText = !sort ? "Most urgent first" : sort.id === "name" ? `Client, ${sort.dir === "asc" ? "A to Z" : "Z to A"}` : `${known.get(sort.id)?.label ?? COLUMN_LABELS[sort.id] ?? sort.id}, ${sort.dir === "desc" ? "highest first" : "lowest first"}`;
  const press = (id) => setSort(nextSort(sort, id));

  const tabs = TABS.map((t) => ({
    value: t.key,
    label: <>{t.label}<span className="font-medium text-by-muted tabular-nums">{loading ? "" : counts[t.key]}</span></>,
  }));

  const dateMenu = (
    <Menu>
      <MenuTrigger asChild>
        <DropdownTrigger leading={<Calendar aria-hidden="true" />} aria-label={`Date range: ${rangeLabel}`}>
          <span className="font-semibold">{rangeLabel}</span>
        </DropdownTrigger>
      </MenuTrigger>
      <MenuContent align="end" className="max-h-80 overflow-y-auto">
        {DATE_PRESETS.map((p) => (
          <MenuItem key={p.value} selected={p.value === datePreset} onSelect={() => setDatePreset(p.value)}>{sentence(p.label)}</MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-by-canvas font-by-body text-by-body text-by-text selection:bg-by-accent-line selection:text-by-text">
      {header ? header({ datePreset, rangeLabel, setDatePreset, dateMenu }) : (
      <header className="flex shrink-0 items-center gap-2.5 border-b border-by-line bg-by-surface px-7 py-3.5">
        <div className="min-w-0 flex-1">
          <h1 className="font-by-display text-by-title leading-[1.2] font-bold tracking-[-0.01em]">Clients</h1>
          <p className="truncate text-by-body text-by-muted">
            {loading ? "Loading your clients" : `${counts.risk} ${counts.risk === 1 ? "client" : "clients"} at risk · ${counts.all} active`}
          </p>
        </div>
        {synced && <span className="mx-1 hidden text-by-body-sm text-by-muted min-[1200px]:inline">Synced {synced}</span>}
        <Button onClick={openImport}><Files aria-hidden="true" />Import</Button>
        <Button kind="primary" onClick={openAddClient}><Plus aria-hidden="true" />Add client</Button>
        {dateMenu}
      </header>
      )}

      {/* Nothing here scrolls: the tabs and toolbar stay put and only the table scrolls, inside its card. */}
      <div className={`flex min-h-0 flex-1 flex-col px-7 pt-4.5 ${footer ? "pb-3" : "pb-6"}`}>
        <TabPill
          items={tabs}
          value={tab}
          onValueChange={setTab}
          fill
          aria-label="Clients by status"
          toolbar={
            <>
            <Menu>
              <MenuTrigger className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-by-md px-2 text-by-text-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-by-accent">
                Sort: <span className="font-semibold text-by-text">{sortText}</span><ChevronDown aria-hidden="true" className="size-3.5" />
              </MenuTrigger>
              <MenuContent align="end" className="max-h-80 overflow-y-auto">
                <MenuItem selected={!sort} onSelect={() => setSort(null)}>Most urgent first</MenuItem>
                <MenuItem selected={sort?.id === "name"} onSelect={() => setSort({ id: "name", dir: "asc" })}>Client, A to Z</MenuItem>
                <MenuSeparator />
                {columns.map((c) => (
                  <MenuItem key={c.id} selected={sort?.id === c.id} onSelect={() => setSort({ id: c.id, dir: "desc" })}>{c.label}, highest first</MenuItem>
                ))}
              </MenuContent>
            </Menu>
            <SearchField className="w-56" placeholder="Search clients" value={query} onChange={(e) => setQuery(e.target.value)} />
            <ColumnsMenu
              columns={grouped}
              value={shownIds}
              onChange={setColumnIds}
              views={savedViews(grouped, saved)}
              onSaveView={viewsLoaded ? () => saveView(["name", ...shownIds]).then(() => setColumnIds(null)) : undefined}
              onOpenChange={setColumnsOpen}
            />
            </>
          }
        >
          {TABS.map((t) => (
            <TabPanel key={t.key} value={t.key} className="mt-3.5 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
              {error ? (
                <Notice tone="danger" action={<Button size="sm" onClick={() => refresh()}>Retry</Button>}>Couldn’t load your clients. Check your connection and try again.</Notice>
              ) : !loading && rows.length === 0 ? (
                <Card>
                  <EmptyState icon={<Users />} title="No clients yet" action={<div className="flex gap-2"><Button onClick={openImport}><Files aria-hidden="true" />Import from GoHighLevel</Button><Button kind="primary" onClick={openAddClient}><Plus aria-hidden="true" />Add client</Button></div>}>
                    Add your first client, or bring several in at once from GoHighLevel.
                  </EmptyState>
                </Card>
              ) : !loading && visible.length === 0 ? (
                <Card>
                  {query.trim() ? (
                    <EmptyState icon={<SearchX />} title="No clients match" action={<Button kind="soft" onClick={() => setQuery("")}>Clear search</Button>}>
                      Nothing in {t.label} matches “{query.trim()}”.
                    </EmptyState>
                  ) : (
                    <EmptyState title={EMPTY_TAB[t.key]} />
                  )}
                </Card>
              ) : (
                <TableScroll className={`motion-safe:animate-[by-enter_var(--by-dur-enter)_var(--by-ease-spring)] ${columnsOpen ? "min-[1100px]:mr-60" : ""}`}>
                  <Table>
                    <TableHead>
                      <tr>
                        <Th sort={sort?.id === "name" ? sort.dir : null} onSort={() => press("name")} className="left-0 z-20 min-w-64">Client</Th>
                        <Th className="w-36">Status</Th>
                        {columns.map((c) => (
                          <Th key={c.id} numeric sort={sort?.id === c.id ? sort.dir : null} onSort={() => press(c.id)}>
                            {c.icon ? <span className="inline-flex max-w-44 items-center gap-1 [&_svg]:size-3 [&_svg]:shrink-0" title={c.label}>{c.icon}<span className="truncate">{c.label}</span></span> : c.label}
                          </Th>
                        ))}
                        <Th className="w-9"><span className="sr-only">Open</span></Th>
                      </tr>
                    </TableHead>
                    <TableBody>
                      {loading
                        ? [0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                            <Tr key={i}>
                              <Td><Skeleton className="w-40" /></Td>
                              <Td><Skeleton className="w-16" /></Td>
                              {columns.map((c) => <Td key={c.id} numeric><Skeleton className="ml-auto w-12" /></Td>)}
                              <Td />
                            </Tr>
                          ))
                        : visible.map((row) => {
                            const pill = PILL[row.listStatus];
                            return (
                              <Tr
                                key={row.id}
                                interactive
                                // The whole row is a click target for the mouse; the name inside is the link keyboards and screen readers use.
                                onClick={() => router.push(clientHref(row.id))}
                                className={row.listStatus === "off" ? "text-by-muted" : undefined}
                              >
                                {/* Pinned, so the name stays in view when many columns scroll sideways. Its divider is an inset shadow: a collapsed border does not travel with a pinned cell. */}
                                <Td className="sticky left-0 max-w-80 truncate border-b-0 bg-by-surface font-semibold shadow-[inset_0_-1px_0_var(--by-line-soft)] transition-colors duration-(--by-dur-fast) ease-by-out group-hover:bg-by-canvas" title={row.name}>
                                  <Link href={clientHref(row.id)} onClick={(e) => e.stopPropagation()} className="rounded-by-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-by-accent">{row.name}</Link>
                                </Td>
                                <Td>
                                  {row.syncing ? <span className="text-by-body-sm text-by-muted">Loading {rangeLabel.toLowerCase()}…</span> : pill ? <Pill tone={pill[0]}>{pill[1]}</Pill> : null}
                                </Td>
                                {columns.map((c) => (
                                  <Td key={c.id} numeric>
                                    {row.syncing ? (
                                      <Skeleton className="ml-auto w-12" />
                                    ) : c.id === "cost_per_lead" && overTarget(row[c.id], row.cplTarget) ? (
                                      <span className="font-semibold text-by-danger">{formatCell(row[c.id], c.id, { customMetrics, currencySymbol })}</span>
                                    ) : (
                                      formatCell(row[c.id], c.id, { customMetrics, currencySymbol })
                                    )}
                                  </Td>
                                ))}
                                <RowArrow />
                              </Tr>
                            );
                          })}
                    </TableBody>
                  </Table>
                </TableScroll>
              )}
            </TabPanel>
          ))}
        </TabPill>
      </div>
      {footer && <div className="shrink-0 px-7 pb-5">{footer}</div>}
    </div>
  );
}
