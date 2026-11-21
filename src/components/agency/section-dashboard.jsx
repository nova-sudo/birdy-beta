"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Phone } from "lucide-react";
import {
  Card, CplChip, Notice, RowArrow, SearchField, SectionHeader, Skeleton, TabPill, Table, TableBody, TableHead, Td, Th, Tr, Button,
} from "@/components/by";
import { BUYER_CLIENT_VIEWS, COACH_CLIENT_VIEWS, ClientDashboard } from "@/components/agency/client-dashboard";
import { CallsTable, LeadsTable, RepsTable } from "@/components/agency/client-tables";
import { ClientFilter, useDrill } from "@/components/agency/buyer-drill";
import { AdsDrill, adLeadsCapped } from "@/components/agency/ads-drill";
import { resolveSection } from "@/components/agency/sections";
import { sectionTabHref, useSectionTabs } from "@/components/agency/tabs";
import { SectionMore } from "@/components/agency/section-more";
import { useOpenSuggestions } from "@/components/agency/use-suggestions";
import { apiRequest } from "@/lib/api";
import { AGENCY_DRILL, CLIENT_DRILL, drillNames, drillQuery } from "@/lib/buyer-drill";
import { AD_LEADS_LIMIT, AD_LEVELS, adLeadRow, adLevelRows, callRows, repRows, searchBy, sortBy, toggleSort } from "@/lib/client-tables";
import { activeGroups } from "@/lib/client-status";
import { presetToDateRange } from "@/lib/date-utils";
import { buyerClientRows, coachClientRows } from "@/lib/section-birds-eye";
import { useClientGroups } from "@/lib/useClientGroups";
import { useClientGroupsWithSeries } from "@/lib/useClientGroupsWithSeries";
import getSymbolFromCurrency from "currency-symbol-map";
import { AskDock, PAGE, RangeMenu, useAddressRange, useMoney, useSectionChat } from "./section-parts";
import { TableCard, tableState, useColumns } from "./table-card";

const CALLS_LIMIT = 500;
const json = async (url) => {
  const res = await apiRequest(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};
const rangeQuery = (preset) => {
  const { start_date, end_date } = presetToDateRange(preset);
  return `${start_date ? `&start_date=${start_date}` : ""}${end_date ? `&end_date=${end_date}` : ""}`;
};
const whole = (n) => Math.round(n).toLocaleString("en-GB");

/**
 * Media Buyer's or Sales Coach's Dashboard tab. For the agency it is the section's own table;
 * inside a client (`?client=<id>`) it is that client's tables for the section.
 *
 * @param {import("./sections").SectionConfig} props.section
 */
export function SectionDashboard({ section: which }) {
  const section = resolveSection(which);
  const clientId = useSearchParams().get("client");
  if (clientId) return <ClientDashboard clientId={clientId} section={section} views={section.key === "coach" ? COACH_CLIENT_VIEWS : BUYER_CLIENT_VIEWS} />;
  return section.key === "coach" ? <CoachDashboard section={section} /> : <BuyerDashboard section={section} />;
}

/** The client groups for the address's date range. The hooks hold the range in their own state, so it is pushed in. */
function useRangeGroups(hook, preset, options) {
  const groups = hook(preset, options);
  const { datePreset, setDatePreset } = groups;
  useEffect(() => {
    if (datePreset !== preset) setDatePreset(preset);
  }, [preset, datePreset, setDatePreset]);
  return { ...groups, loading: groups.loading || datePreset !== preset };
}

/** The frame both dashboards share: the header, the caption, the view pill, the table and the ask bar under it. */
function Frame({ section, range, caption, views, children }) {
  const router = useRouter();
  const search = useSearchParams();
  const tabs = useSectionTabs(section);
  const chat = useSectionChat(section, "ask_table", null);
  return (
    <div className={PAGE}>
      <SectionHeader
        section={section.kit}
        tabs={tabs}
        tab="dashboard"
        more={<SectionMore section={section} tab="dashboard" />}
        onTabChange={(value) => value !== "dashboard" && router.push(sectionTabHref(section, value, search))}
        dateRange={<RangeMenu preset={range.preset} label={range.label} onPick={range.setPreset} />}
      />
      <AskDock section={section} chat={chat} floating={false} placeholder={`Ask ${section.kit.name} about ${section.askAbout}, or tell it what to change`}>
        {/* The same 1040px column as Bird's Eye. Nothing here scrolls but the table inside its card. */}
        <div className="mx-auto flex min-h-0 w-full max-w-[calc(1040px+3.5rem)] flex-1 flex-col px-7 pt-5 pb-3">
          <div className="shrink-0 text-by-body-sm font-medium text-by-text-2">{range.label} · {caption}</div>
          {views && <div className="mt-3.5 shrink-0">{views}</div>}
          <div className="mt-5 flex min-h-0 flex-1 flex-col">{children}</div>
        </div>
      </AskDock>
    </div>
  );
}

/** The view pill, kept in the address as `?view=` so a link opens the same table. */
function useView(views) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const requested = search.get("view");
  const view = views.some((v) => v.value === requested) ? requested : views[0].value;
  const setView = (value) => {
    const next = new URLSearchParams(search.toString());
    if (value === views[0].value) next.delete("view");
    else next.set("view", value);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };
  return [view, setView];
}

/** Opening a client: the same tab, narrowed to it. */
function useOpenClient() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  return (id) => {
    const next = new URLSearchParams();
    if (search.get("range")) next.set("range", search.get("range"));
    next.set("client", id);
    router.push(`${pathname}?${next.toString()}`);
  };
}

const sortHeader = (sort, setSort) => (id, first) => ({ sort: sort?.id === id ? sort.dir : null, onSort: () => setSort((s) => toggleSort(s, id, first)) });

// ── Media Buyer ─────────────────────────────────────────────────────────────

const CPL_TONE = (cpl, limit) => (cpl == null || !(limit > 0) ? null : cpl > limit ? "danger" : cpl > limit * 0.8 ? "warning" : "success");

/**
 * Media Buyer's Dashboard for the agency: every client's ads on one table, by client, campaign, ad set, ad or lead.
 * Clients over their limit and those with suggestions waiting come first. Clicking a row narrows the next level to it
 * (a client to its campaigns, down to an ad's leads); the level and filters live in the address.
 * The levels and drill are the shared Ads table's (ads-drill.jsx); only the Clients level is drawn here.
 */
function BuyerDashboard({ section }) {
  const range = useAddressRange();
  const { clientGroups, loading, error, refresh } = useRangeGroups(useClientGroups, range.preset, { includeDaily: false });
  const groups = useMemo(() => activeGroups(clientGroups), [clientGroups]);
  const ids = groups.map((g) => g.id).join(",");
  const rollup = useSWR(ids ? `/api/campaigns/opp-rollup?groups=${encodeURIComponent(ids)}${rangeQuery(range.preset)}` : null, json, { revalidateOnFocus: false, keepPreviousData: true });
  // The leads the Marketing Hub listed: every ad-attributed lead, with the ad, ad set and campaign it came from.
  const leadsRes = useSWR(ids ? `/api/facebook-leads/filtered?groups=${encodeURIComponent(ids)}&limit=${AD_LEADS_LIMIT}${rangeQuery(range.preset)}` : null, json, { revalidateOnFocus: false, keepPreviousData: true });
  const waiting = useOpenSuggestions(section.ownsSuggestion);
  const symbol = getSymbolFromCurrency(groups.find((g) => g.facebook?.currency || g.ad_account_currency)?.facebook?.currency || groups.find((g) => g.ad_account_currency)?.ad_account_currency || "GBP") || "£";
  const { money } = useMoney(symbol);
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const nav = useDrill(AGENCY_DRILL);

  const levels = useMemo(() => {
    const byName = new Map();
    for (const s of waiting) {
      const key = String(s.client ?? "").trim().toLowerCase();
      byName.set(key, (byName.get(key) ?? 0) + 1);
    }
    const clients = buyerClientRows(groups).map((r) => {
      const open = byName.get(r.name.trim().toLowerCase()) ?? 0;
      return { ...r, groupId: r.id, open, urgency: (r.standing === "over" ? 2 : 0) + (open > 0 ? 1 : 0) };
    });
    const out = { clients };
    for (const spec of AD_LEVELS) {
      out[spec.key] = groups.flatMap((g) => adLevelRows(g, rollup.data, spec.key).map((row) => ({
        ...row, id: `${g.id}:${row.id}`, groupId: g.id, adId: spec.key === "ads" ? row.id : "", client: g.name, limit: Number(g.targets?.cpl) > 0 ? Number(g.targets.cpl) : null,
      })));
    }
    // Names are copied onto each lead when it is stored; the client's current name comes from its id.
    const names = new Map(groups.map((g) => [String(g.id), g.name]));
    out.leads = (leadsRes.data?.leads ?? []).map(adLeadRow).filter((r) => names.has(r.groupId)).map((r) => ({ ...r, client: names.get(r.groupId) }));
    return out;
  }, [groups, rollup.data, leadsRes.data, waiting]);
  const nameOf = useMemo(() => drillNames(groups), [groups]);

  // A client's own dashboard, opened from its chip, keeps the campaign, ad set and ad the drill had reached.
  const openClient = (id) => {
    const next = new URLSearchParams();
    if (search.get("range")) next.set("range", search.get("range"));
    next.set("client", id);
    router.push(`${pathname}?${drillQuery(next, nav.level, nav.drill, CLIENT_DRILL)}`);
  };

  const clientsLevel = {
    sort: { id: "urgency", dir: "desc" },
    render: ({ rows, header, drillRow }) => (
      <Table>
        <TableHead>
          <tr>
            <Th {...header("name", "asc")} className="min-w-52">Client</Th>
            <Th numeric {...header("leads")}>Leads</Th>
            <Th numeric {...header("cpl", "asc")}>CPL</Th>
            <Th numeric {...header("spend")}>Ad spend</Th>
            <Th numeric {...header("limit", "asc")}>Limit</Th>
            <Th {...header("open")}>To review</Th>
            <Th aria-label="Open" className="w-9" />
          </tr>
        </TableHead>
        <TableBody>
          {rows.map((row) => {
            const tone = CPL_TONE(row.cpl, row.limit);
            return (
              <Tr key={row.id} interactive onClick={() => drillRow(row)}>
                <Td className="max-w-72 truncate font-semibold" title={row.name}>{row.name}</Td>
                {row.cpl == null && row.spend === 0 ? (
                  <Td numeric colSpan={3} className="text-by-muted">No spend in this range</Td>
                ) : (
                  <>
                    <Td numeric>{whole(row.leads)}</Td>
                    <Td numeric>{row.cpl == null ? <span className="text-by-muted">No leads</span> : tone ? <CplChip tone={tone}>{money(row.cpl, 2)}</CplChip> : money(row.cpl, 2)}</Td>
                    <Td numeric>{money(row.spend, 2)}</Td>
                  </>
                )}
                <Td numeric className={row.limit ? "" : "text-by-muted"}>{row.limit ? money(row.limit, 2) : "None set"}</Td>
                <Td>{row.open > 0 ? <span className="font-semibold text-by-accent">{row.open} {row.open === 1 ? "suggestion" : "suggestions"}</span> : <span className="text-by-muted">—</span>}</Td>
                <RowArrow />
              </Tr>
            );
          })}
        </TableBody>
      </Table>
    ),
  };

  const fetched = leadsRes.data?.leads?.length ?? 0;
  return (
    <Frame section={section} range={range} caption={loading ? "Loading" : `${groups.length} client${groups.length === 1 ? "" : "s"}`}>
      <AdsDrill
        nav={nav}
        levels={levels}
        ads={{ loading, error: Boolean(error) && clientGroups.length === 0, retry: refresh }}
        leads={{ loading: loading || (Boolean(ids) && leadsRes.isLoading), error: Boolean(leadsRes.error) && !leadsRes.data, retry: () => leadsRes.mutate(), capped: adLeadsCapped(fetched) }}
        nameOf={nameOf}
        currencySymbol={symbol}
        showClient
        toolbarEnd={<ClientFilter clients={groups.map((g) => ({ id: String(g.id), name: g.name }))} value={nav.drill.group ?? null} onChange={nav.pickClient} />}
        onOpenClient={openClient}
        custom={{ clients: clientsLevel }}
      />
    </Frame>
  );
}

// ── Sales Coach ─────────────────────────────────────────────────────────────

const COACH_VIEWS = [
  { value: "centres", label: "Call centres" },
  { value: "calls", label: "Calls" },
  { value: "reps", label: "Callers" },
];
const STANDING = [
  { value: "all", label: "All", keep: () => true },
  { value: "behind", label: "Behind", keep: (r) => Boolean(r.behind) },
  { value: "ok", label: "On pace", keep: (r) => !r.behind },
];
const CENTRE_COLUMNS = [{ id: "calls", label: "Calls" }, { id: "talk", label: "Talk time" }, { id: "answered", label: "Answered" }, { id: "closes", label: "Closed" }];

/**
 * Sales Coach's Dashboard for the agency: every client with a call centre (behind first), every call, and every caller.
 */
function CoachDashboard({ section }) {
  const range = useAddressRange();
  const [view, setView] = useView(COACH_VIEWS);
  const { clientGroups, loading, error, refresh } = useRangeGroups(useClientGroupsWithSeries, range.preset);
  const centres = useMemo(() => coachClientRows(clientGroups, range.preset), [clientGroups, range.preset]);

  // Every call in the range, across the agency, only once the Calls or Callers table is opened.
  const callsKey = view === "centres" ? null : `/api/hotprospector/call-center?skip=0&limit=${CALLS_LIMIT}&has_calls=true${rangeQuery(range.preset)}`;
  const calls = useSWR(callsKey, json, { revalidateOnFocus: false, keepPreviousData: true });
  const callData = useMemo(() => {
    const leads = calls.data?.data ?? [];
    const total = calls.data?.meta?.total ?? leads.length;
    return {
      rows: callRows(leads),
      loading: calls.isLoading,
      error: Boolean(calls.error) && !calls.data,
      retry: () => calls.mutate(),
      capped: total > leads.length ? `Showing the calls of ${whole(leads.length)} of the ${whole(total)} leads called in this range.` : "",
    };
  }, [calls]);

  const counts = { centres: loading ? undefined : centres.length, calls: calls.data ? callData.rows.length : undefined, reps: calls.data ? repRows(callData.rows).length : undefined };

  return (
    <Frame
      section={section}
      range={range}
      caption={loading ? "Loading" : `${centres.length} client${centres.length === 1 ? "" : "s"} with a call centre`}
      views={<TabPill aria-label="Tables" items={COACH_VIEWS.map((v) => ({ ...v, count: counts[v.value] }))} value={view} onValueChange={setView} />}
    >
      {view === "centres" ? (
        <CentresTable rows={centres} loading={loading} error={Boolean(error) && clientGroups.length === 0} retry={refresh} />
      ) : view === "calls" ? (
        <CallsTable data={callData} showClient />
      ) : (
        <RepsTable data={callData} />
      )}
    </Frame>
  );
}

/** One row per client with a call centre: new leads in the CRM, how many got a call, what the dialler did, and who is behind. */
function CentresTable({ rows: all, loading, error, retry }) {
  const openClient = useOpenClient();
  const [standing, setStanding] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState({ id: "behindFirst", dir: "desc" });
  const columns = useColumns(CENTRE_COLUMNS);
  const keyed = useMemo(() => all.map((r) => ({ ...r, behindFirst: (r.behind ? 1e9 : 0) + (r.inCrm ?? 0) })), [all]);
  const keep = STANDING.find((s) => s.value === standing).keep;
  const rows = useMemo(() => sortBy(searchBy(keyed.filter(keep), query, ["name"]), sort), [keyed, keep, query, sort]);
  const header = sortHeader(sort, setSort);

  if (loading) return <Card aria-busy="true" aria-label="Loading the table" className="px-5 py-5"><Skeleton className="w-48" /><Skeleton className="mt-4 h-40 w-full rounded-by-md" /></Card>;
  if (error) return <Notice tone="danger" action={<Button size="sm" onClick={retry}>Retry</Button>}>Couldn’t load your call centres. Check your connection and try again.</Notice>;
  return (
    <TableCard
      toolbar={
        <>
          <TabPill aria-label="Show" value={standing} onValueChange={setStanding} items={STANDING.map((s) => ({ value: s.value, label: s.label, count: keyed.filter(s.keep).length }))} />
          <span className="text-by-body-sm text-by-muted max-lg:hidden">Behind: under half of new leads called</span>
          <div className="ml-auto flex items-center gap-2.5">
            <SearchField className="w-52" placeholder="Search clients" value={query} onChange={(e) => setQuery(e.target.value)} />
            {columns.menu}
          </div>
        </>
      }
      state={tableState({ data: { rows: all, loading: false, error: false }, shown: rows.length, noun: "clients", icon: <Phone />, empty: { title: "No client has a call centre", body: "Connect Hot Prospector in Settings and each client’s call centre appears here." } })}
    >
      <Table>
        <TableHead>
          <tr>
            <Th {...header("name", "asc")} className="min-w-44">Client</Th>
            <Th numeric {...header("inCrm")}>New in CRM</Th>
            <Th numeric {...header("share", "asc")}>Called</Th>
            {columns.shows("calls") && <Th numeric {...header("calls")}>Calls</Th>}
            {columns.shows("talk") && <Th numeric {...header("talk")}>Talk time</Th>}
            {columns.shows("answered") && <Th numeric {...header("answered", "asc")}>Answered</Th>}
            {columns.shows("closes") && <Th numeric {...header("closes")}>Closed</Th>}
            <Th>Behind</Th>
            <Th aria-label="Open" className="w-9" />
          </tr>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <Tr key={row.id} interactive onClick={() => openClient(row.id)}>
              <Td className="max-w-56 truncate font-semibold" title={row.name}>{row.name}</Td>
              <Td numeric className={row.inCrm == null ? "text-by-muted" : ""}>{row.inCrm == null ? "Not ready" : whole(row.inCrm)}</Td>
              <Td numeric>
                {row.inCrm == null ? <span className="text-by-muted">—</span> : row.inCrm === 0 ? <span className="text-by-muted">None to call</span> : (
                  <><span className={row.called === 0 ? "font-semibold text-by-danger" : ""}>{whole(row.called)}</span><span className="text-by-muted"> · {Math.round(row.share)}%</span></>
                )}
              </Td>
              {columns.shows("calls") && <Td numeric>{whole(row.calls)}</Td>}
              {columns.shows("talk") && <Td numeric>{whole(row.talk)} min</Td>}
              {columns.shows("answered") && <Td numeric className={row.answered == null ? "text-by-muted" : ""}>{row.answered == null ? "—" : `${Math.round(row.answered)}%`}</Td>}
              {columns.shows("closes") && <Td numeric>{whole(row.closes)}</Td>}
              <Td title={row.behind ?? undefined}>{row.behind ? <span className="font-semibold whitespace-nowrap text-by-danger">{row.inCrm === 0 ? "None in CRM" : "Under half called"}</span> : <span className="text-by-muted">—</span>}</Td>
              <RowArrow />
            </Tr>
          ))}
        </TableBody>
      </Table>
    </TableCard>
  );
}

