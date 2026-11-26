"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Users } from "lucide-react";
import getSymbolFromCurrency from "currency-symbol-map";
import { Button, Card, EmptyState, Notice, SectionHeader, Skeleton } from "@/components/by";
import { PageTabPanel, PageTabs } from "@/components/portfolio";
import { OPS_SECTION } from "@/components/agency/sections";
import { sectionTabHref, useSectionTabs } from "@/components/agency/tabs";
import { SectionMore } from "@/components/agency/section-more";
import { CallsTable, LeadPager, LeadsTable, PipelinePicker, RepsTable } from "@/components/agency/client-tables";
import { AdsDrill, adLeadsCapped } from "@/components/agency/ads-drill";
import { useDrill } from "@/components/agency/buyer-drill";
import { leadHref } from "@/components/agency/lead/lead-modal";
import { useClientTables } from "@/components/agency/use-client-tables";
import { AskDock, PAGE, RangeMenu, scopedSubtitle, useAddressRange, useRangeGroups, useSectionChat } from "@/components/agency/section-parts";
import { CLIENT_DRILL, drillNames } from "@/lib/buyer-drill";
import { groupHasCallCentre } from "@/lib/call-centre-availability";
import { repRows } from "@/lib/client-tables";
import { pdFontClass } from "@/lib/pd-fonts";
import { useClientGroupsWithSeries } from "@/lib/useClientGroupsWithSeries";

/** The client's three tables, and what the ask bar says on each. The lead pipeline opens first. */
export const CLIENT_VIEWS = [
  { value: "leads", label: "Leads", ask: "leads" },
  { value: "ads", label: "Ads", ask: "ads" },
  { value: "calls", label: "Calls", ask: "calls" },
];
/** Marketing Guru's tables inside a client: its ads first (campaigns, ad sets and ads), then the leads they brought. */
export const BUYER_CLIENT_VIEWS = [
  { value: "ads", label: "Ads", ask: "ads" },
  { value: "leads", label: "Leads", ask: "leads" },
];
/** Sales Coach's tables inside a client: its calls, and who made them. */
export const COACH_CLIENT_VIEWS = [
  { value: "calls", label: "Calls", ask: "calls" },
  { value: "reps", label: "Callers", ask: "callers" },
];
// Agency Ops' Ads table opens on the ads themselves, as it always has; Marketing Guru's on the campaigns.
const OPS_ADS_DRILL = { ...CLIENT_DRILL, first: "ads" };
const VIEWS_PANEL_ID = "client-dashboard-panel";

/**
 * A section's Dashboard tab inside one client (`?client=<id>`): the client's lead pipeline, Ads and
 * Calls tables, each scrolling inside its card, under the section's header and with its ask bar.
 * Every question asked here is limited to this client. Agency Ops shows Leads, Ads and Calls; the
 * other sections can pass their own (see BUYER_CLIENT_VIEWS, COACH_CLIENT_VIEWS).
 *
 * The address carries what is open, so a lead's back link and the browser's Back return to it:
 * `view` (left out for the first), `pipeline` and `stage` on the Leads table, and its `page`.
 * The date range is the header's `?range=`, shared with the section's other tabs.
 *
 * @param {string} props.clientId
 * @param {import("./sections").SectionConfig} [props.section] Agency Ops when left out
 * @param {{value: string, label: string, ask: string}[]} [props.views] the tables, the first one opening by default
 */
export function ClientDashboard({ clientId, section = OPS_SECTION, views = CLIENT_VIEWS }) {
  const ops = section === OPS_SECTION;
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const tabs = useSectionTabs(section);
  const range = useAddressRange();
  const { clientGroups, loading, error, refresh } = useRangeGroups(useClientGroupsWithSeries, range.preset);
  const client = useMemo(() => clientGroups.find((g) => g.id === clientId) ?? null, [clientGroups, clientId]);

  const first = views[0].value;
  const requested = search.get("view");
  const view = views.some((v) => v.value === requested) ? requested : first;
  const current = views.find((v) => v.value === view);

  // The pipeline and stage the address asks for; the hook checks them against the CRM's own.
  const page = Math.max(1, Number.parseInt(search.get("page") ?? "1", 10) || 1);
  const tables = useClientTables(client, range.preset, { adLeads: view === "ads", pipeline: search.get("pipeline"), stage: search.get("stage"), page });
  const { pipelines, pipeline, stage } = tables.leads;

  const callsData = client && !groupHasCallCentre(client) ? { ...tables.calls, unavailable: true } : tables.calls;
  const currencySymbol = getSymbolFromCurrency(client?.facebook?.currency || client?.ad_account_currency || "GBP") || "£";
  const counts = {
    leads: tables.leads.allTotal ?? (tables.leads.loading ? undefined : tables.leads.rows.length),
    ads: tables.ads.rows.length,
    calls: callsData.unavailable ? undefined : callsData.rows.length,
    reps: callsData.unavailable ? undefined : repRows(callsData.rows).length,
  };

  /** The address with some of its query changed; null removes a key. */
  const go = (changes) => {
    const next = new URLSearchParams(search.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value == null || value === "") next.delete(key);
      else next.set(key, value);
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };
  const setView = (value) => go({ view: value === first ? null : value });

  const chat = useSectionChat(section, `ask_${view}`, client);

  let body;
  if (error) {
    body = <Notice tone="danger" action={<Button size="sm" onClick={() => refresh()}>Retry</Button>}>Couldn’t load this client. Check your connection and try again.</Notice>;
  } else if (loading) {
    body = <Card aria-busy="true" aria-label="Loading the table" className="px-5 py-5"><Skeleton className="w-48" /><Skeleton className="mt-4 h-40 w-full rounded-by-md" /></Card>;
  } else if (!client) {
    body = <Card><EmptyState icon={<Users />} title="This client isn’t in your account">It may have been removed. Pick another from the switcher at the top of the rail.</EmptyState></Card>;
  } else if (view === "leads") {
    body = (
      <ClientLeads
        leads={tables.leads}
        pipelines={pipelines}
        pipeline={pipeline}
        stage={stage}
        currencySymbol={currencySymbol}
        onPipeline={(id) => go({ pipeline: id, stage: null, page: null })}
        onStage={(id) => go({ stage: id === "all" ? null : id, page: null })}
        onPage={(n) => go({ page: n > 1 ? String(n) : null })}
        onOpenLead={(row) => router.push(leadHref(row.contactId))}
      />
    );
  } else if (view === "ads") {
    body = <ClientAdsDrill client={client} tables={tables} currencySymbol={currencySymbol} scope={ops ? OPS_ADS_DRILL : CLIENT_DRILL} />;
  } else if (view === "reps") {
    body = <RepsTable data={callsData} />;
  } else {
    body = <CallsTable data={callsData} />;
  }

  return (
    <div className={PAGE}>
      <SectionHeader
        section={section.kit}
        subtitle={scopedSubtitle(client)}
        tabs={tabs}
        tab="dashboard"
        more={<SectionMore section={section} tab="dashboard" />}
        onTabChange={(value) => value !== "dashboard" && router.push(sectionTabHref(section, value, search))}
        dateRange={<RangeMenu preset={range.preset} label={range.label} onPick={range.setPreset} />}
      />
      <AskDock
        section={section}
        chat={chat}
        floating={false}
        title={client ? `${section.kit.name} · ${client.name}` : undefined}
        placeholder={client ? `Ask ${section.kit.name} about ${client.name}’s ${current.ask}` : `Ask ${section.kit.name}`}
      >
        {/* Full width. Nothing here scrolls but the table inside its card. */}
        <div className={`${pdFontClass} flex min-h-0 w-full flex-1 flex-col px-7 pt-6 pb-3`}>
          <div className="mb-[14px] shrink-0">
            <PageTabs
              label={client ? `${client.name}’s tables` : "Tables"}
              panelId={VIEWS_PANEL_ID}
              tabs={views.map((v) => ({ key: v.value, label: v.label, badge: client ? counts[v.value] : undefined }))}
              value={view}
              onChange={setView}
            />
          </div>
          <PageTabPanel id={VIEWS_PANEL_ID} label={current.label} className="flex min-h-0 flex-1 flex-col">
            {body}
          </PageTabPanel>
        </div>
      </AskDock>
    </div>
  );
}

/**
 * The client's lead pipeline: the CRM's stages as tabs, with the pipeline picker when there is
 * more than one, and every lead in the picked stage a row. Without pipelines from the backend it
 * is the Leads table with Birdy's own four stages, as it was.
 */
function ClientLeads({ leads, pipelines, pipeline, stage, currencySymbol, onPipeline, onStage, onPage, onOpenLead }) {
  // Until the first page answers, no tabs: neither Birdy's four nor the CRM's would be right yet.
  if (!pipeline) {
    return <LeadsTable data={leads} currencySymbol={currencySymbol} stageTabs={leads.known} onOpenLead={onOpenLead} />;
  }
  const tabs = [
    { value: "all", label: "All", count: leads.allTotal ?? undefined },
    ...pipeline.stages.map((st) => ({ value: st.id, label: st.name, count: st.count })),
  ];
  return (
    <LeadsTable
      // A new stage is a new list: search and sorting start again.
      key={`${pipeline.id}:${stage?.id ?? "all"}`}
      data={{ ...leads, capped: "" }}
      currencySymbol={currencySymbol}
      pipeline={{
        tabs,
        value: stage?.id ?? "all",
        onValueChange: onStage,
        picker: pipelines.length > 1 ? <PipelinePicker pipelines={pipelines} value={pipeline.id} onChange={onPipeline} /> : null,
      }}
      onOpenLead={onOpenLead}
      footer={!leads.loading && !leads.error && <LeadPager page={leads.page} pages={leads.pages} limit={leads.limit} total={leads.total} shown={leads.rows.length} onPage={onPage} />}
      empty={stage ? { title: `No leads in ${stage.name}`, body: "Pick another stage, or try a longer date range." } : undefined}
    />
  );
}

/**
 * The client's Ads table: the agency table's levels and drill-down without its Clients level,
 * always this client's campaigns, ad sets, ads and the leads they brought in.
 */
function ClientAdsDrill({ client, tables, currencySymbol, scope }) {
  const nav = useDrill(scope);
  const nameOf = useMemo(() => drillNames([client]), [client]);
  const levels = useMemo(() => ({ ...tables.ads.levels, leads: tables.adLeads.rows }), [tables.ads.levels, tables.adLeads.rows]);
  return (
    <AdsDrill
      nav={nav}
      levels={levels}
      ads={tables.ads}
      leads={{ ...tables.adLeads, capped: adLeadsCapped(tables.adLeads.fetched) }}
      nameOf={nameOf}
      currencySymbol={currencySymbol}
      columnsMenu
      adsOf="this client’s ads"
    />
  );
}
