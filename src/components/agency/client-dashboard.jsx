"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Calendar, MessageSquare, Users } from "lucide-react";
import getSymbolFromCurrency from "currency-symbol-map";
import {
  AskBar, AskPanel, Button, Card, DropdownTrigger, EmptyState, Menu, MenuContent, MenuItem, MenuTrigger, Notice, SectionHeader, Skeleton, TabPill,
} from "@/components/by";
import { ChatThread } from "@/components/agency/chat/thread";
import { useAgentChat } from "@/components/agency/chat/use-agent-chat";
import { OPS_SECTION, sessionKey } from "@/components/agency/sections";
import { sectionTabHref, useSectionTabs } from "@/components/agency/tabs";
import { SectionMore } from "@/components/agency/section-more";
import { CallsTable, LeadsTable, RepsTable } from "@/components/agency/client-tables";
import { AdsDrill, adLeadsCapped } from "@/components/agency/ads-drill";
import { useDrill } from "@/components/agency/buyer-drill";
import { useClientTables } from "@/components/agency/use-client-tables";
import { CLIENT_DRILL, drillNames } from "@/lib/buyer-drill";
import { groupHasCallCentre } from "@/lib/call-centre-availability";
import { isActive } from "@/lib/client-status";
import { statusOf } from "@/lib/clients-list";
import { DATE_PRESETS, DEFAULT_DATE_PRESET } from "@/lib/constants";
import { repRows } from "@/lib/client-tables";
import { rememberSectionChat } from "@/lib/section-chats";
import { useClientGroupsWithSeries } from "@/lib/useClientGroupsWithSeries";

const STATUS_WORDS = { danger: "At risk", warning: "At risk", ok: "On track", off: "Inactive" };
/** The client's three tables, and what the ask bar says on each. */
export const CLIENT_VIEWS = [
  { value: "leads", label: "Leads", ask: "leads" },
  { value: "ads", label: "Ads", ask: "ads" },
  { value: "calls", label: "Calls", ask: "calls" },
];
/** Media Buyer's tables inside a client: its ads first (campaigns, ad sets and ads), then the leads they brought. */
export const BUYER_CLIENT_VIEWS = [
  { value: "ads", label: "Ads", ask: "ads" },
  { value: "leads", label: "Leads", ask: "leads" },
];
/** Sales Coach's tables inside a client: its calls, and who made them. */
export const COACH_CLIENT_VIEWS = [
  { value: "calls", label: "Calls", ask: "calls" },
  { value: "reps", label: "Callers", ask: "callers" },
];
const sentence = (label) => label.charAt(0) + label.slice(1).toLowerCase();
// Agency Ops' Ads table opens on the ads themselves, as it always has; Media Buyer's on the campaigns.
const OPS_ADS_DRILL = { ...CLIENT_DRILL, first: "ads" };

/**
 * A section's Dashboard tab inside one client: its tables on the redesign's
 * table, each scrolling inside its card, and the ask bar. Every question asked
 * here is limited to this client. Agency Ops shows Leads, Ads and Calls; Media
 * Buyer and Sales Coach show their own (see BUYER_CLIENT_VIEWS, COACH_CLIENT_VIEWS).
 *
 * @param {string} props.clientId
 * @param {import("./sections").SectionConfig} [props.section] Agency Ops when left out
 * @param {{value: string, label: string, ask: string}[]} [props.views] the tables, the first one opening by default
 */
export function ClientDashboard({ clientId, section = OPS_SECTION, views = CLIENT_VIEWS }) {
  const OPS = section.kit;
  const ops = section === OPS_SECTION;
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const tabs = useSectionTabs(section);
  const { clientGroups, loading, error, datePreset, setDatePreset, refresh } = useClientGroupsWithSeries(DEFAULT_DATE_PRESET);
  const client = useMemo(() => clientGroups.find((g) => g.id === clientId) ?? null, [clientGroups, clientId]);
  const first = views[0].value;
  const requested = search.get("view");
  const view = views.some((v) => v.value === requested) ? requested : first;
  const tables = useClientTables(client, datePreset, { adLeads: view === "ads" });
  const callsData = client && !groupHasCallCentre(client) ? { ...tables.calls, unavailable: true } : tables.calls;
  const currencySymbol = getSymbolFromCurrency(client?.facebook?.currency || client?.ad_account_currency || "GBP") || "£";
  const counts = { leads: tables.leads.total ?? tables.leads.rows.length, ads: tables.ads.rows.length, calls: callsData.rows.length, reps: repRows(callsData.rows).length };

  const setView = (value) => {
    const next = new URLSearchParams(search.toString());
    if (value === first) next.delete("view");
    else next.set("view", value);
    router.replace(`${pathname}?${next.toString()}`);
  };

  // One thread per table, so a conversation started on Leads does not carry into Calls.
  const chat = useAgentChat({
    sessionKey: sessionKey(section, `ask_${view}_${clientId}`),
    // Agency Ops talks to Birdy with every tool (no page of its own); the others to their own agent.
    ...(ops ? { agent: section.chat.agent } : { page: section.chat.page, agent: section.chat.agent, onSessionId: (id) => rememberSectionChat(section.key, id) }),
    client: client && isActive(client) ? { id: client.id, name: client.name } : null,
  });
  const [asking, setAsking] = useState(false);

  const rangeLabel = sentence((DATE_PRESETS.find((p) => p.value === datePreset) ?? DATE_PRESETS.find((p) => p.value === DEFAULT_DATE_PRESET)).label);
  const subtitle = client ? <>Scoped to <b className="font-semibold text-by-text">{client.name}</b> · {STATUS_WORDS[statusOf(client)]}</> : "One client";
  const current = views.find((v) => v.value === view);

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col bg-by-canvas font-by-body text-by-body text-by-text selection:bg-by-accent-line selection:text-by-text">
        <SectionHeader
          section={OPS}
          subtitle={subtitle}
          tabs={tabs}
          tab="dashboard"
          more={<SectionMore section={section} tab="dashboard" />}
          onTabChange={(value) => value !== "dashboard" && router.push(sectionTabHref(section, value, search))}
          dateRange={
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
          }
        />

        {/* The same 1040px column as Bird's Eye. Nothing here scrolls but the table inside its card. */}
        <div className="mx-auto flex min-h-0 w-full max-w-[calc(1040px+3.5rem)] flex-1 flex-col px-7 pt-5 pb-3">
          <div className="shrink-0 text-by-body-sm font-medium text-by-text-2">{rangeLabel} · {client?.name ?? "Client"}</div>
          <div className="mt-3.5 shrink-0">
            <TabPill
              aria-label={client ? `${client.name}'s tables` : "Tables"}
              items={views.map((v) => ({ value: v.value, label: v.label, count: client ? counts[v.value] : undefined }))}
              value={view}
              onValueChange={setView}
            />
          </div>
          <div className="mt-5 flex min-h-0 flex-1 flex-col">
            {error ? (
              <Notice tone="danger" action={<Button size="sm" onClick={() => refresh()}>Retry</Button>}>Couldn’t load this client. Check your connection and try again.</Notice>
            ) : loading ? (
              <Card aria-busy="true" aria-label="Loading the table" className="px-5 py-5"><Skeleton className="w-48" /><Skeleton className="mt-4 h-40 w-full rounded-by-md" /></Card>
            ) : !client ? (
              <Card><EmptyState icon={<Users />} title="This client isn’t in your account">It may have been removed. Pick another from the switcher at the top of the rail.</EmptyState></Card>
            ) : view === "leads" ? (
              <LeadsTable data={tables.leads} currencySymbol={currencySymbol} />
            ) : view === "ads" ? (
              <ClientAdsDrill client={client} tables={tables} currencySymbol={currencySymbol} scope={ops ? OPS_ADS_DRILL : CLIENT_DRILL} />
            ) : view === "reps" ? (
              <RepsTable data={callsData} />
            ) : (
              <CallsTable data={callsData} />
            )}
          </div>
        </div>

        <div className="shrink-0 px-7 pb-5">
          <AskBar
            className="mx-auto max-w-[820px]"
            placeholder={client ? `Ask ${OPS.name} about ${client.name}'s ${current.ask}` : `Ask ${OPS.name}`}
            busy={chat.loading}
            onSubmit={(text) => {
              setAsking(true);
              chat.send(text);
            }}
          />
        </div>
      </div>
      {asking && (
        <AskPanel
          title={client ? `${OPS.name} · ${client.name}` : OPS.name}
          onClose={() => setAsking(false)}
          follow={`${chat.messages.length}-${chat.loading}`}
          actions={chat.sessionId && (
            <Button kind="ghost" size="sm" onClick={() => router.push(ops ? `/dashboard/chat?client=${encodeURIComponent(clientId)}&c=${encodeURIComponent(chat.sessionId)}` : sectionTabHref(section, "chat", search, { c: chat.sessionId }))}>
              <MessageSquare aria-hidden="true" />Open in Chat
            </Button>
          )}
        >
          <ChatThread chat={chat} name={OPS.name} compact />
        </AskPanel>
      )}
    </div>
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
