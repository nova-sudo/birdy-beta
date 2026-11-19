"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Calendar, MessageSquare, Users } from "lucide-react";
import getSymbolFromCurrency from "currency-symbol-map";
import {
  AskBar, AskPanel, Button, Card, DropdownTrigger, EmptyState, Menu, MenuContent, MenuItem, MenuTrigger, Notice, SECTIONS, SectionHeader, Skeleton, TabPill,
} from "@/components/by";
import { ChatThread } from "@/components/agency/chat/thread";
import { useAgentChat } from "@/components/agency/chat/use-agent-chat";
import { opsTabHref, useOpsTabs } from "@/components/agency/tabs";
import { AdsTable, CallsTable, LeadsTable } from "@/components/agency/client-tables";
import { useClientTables } from "@/components/agency/use-client-tables";
import { groupHasCallCentre } from "@/lib/call-centre-availability";
import { isActive } from "@/lib/client-status";
import { statusOf } from "@/lib/clients-list";
import { DATE_PRESETS, DEFAULT_DATE_PRESET } from "@/lib/constants";
import { useClientGroupsWithSeries } from "@/lib/useClientGroupsWithSeries";

const OPS = SECTIONS.find((s) => s.id === "ops");
const STATUS_WORDS = { danger: "At risk", warning: "At risk", ok: "On track", off: "Inactive" };
/** The client's three tables, and what the ask bar says on each. */
export const CLIENT_VIEWS = [
  { value: "leads", label: "Leads", ask: "leads" },
  { value: "ads", label: "Ads", ask: "ads" },
  { value: "calls", label: "Calls", ask: "calls" },
];
const sentence = (label) => label.charAt(0) + label.slice(1).toLowerCase();

/**
 * Agency Ops' Dashboard tab inside one client: its Leads, Ads and Calls
 * tables on the redesign's table, each scrolling inside its card, and the ask
 * bar. Every question asked here is limited to this client.
 *
 * @param {string} props.clientId
 */
export function ClientDashboard({ clientId }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const tabs = useOpsTabs();
  const { clientGroups, loading, error, datePreset, setDatePreset, refresh } = useClientGroupsWithSeries(DEFAULT_DATE_PRESET);
  const client = useMemo(() => clientGroups.find((g) => g.id === clientId) ?? null, [clientGroups, clientId]);
  const tables = useClientTables(client, datePreset);
  const callsData = client && !groupHasCallCentre(client) ? { ...tables.calls, unavailable: true } : tables.calls;
  const currencySymbol = getSymbolFromCurrency(client?.facebook?.currency || client?.ad_account_currency || "GBP") || "£";
  const counts = { leads: tables.leads.total ?? tables.leads.rows.length, ads: tables.ads.rows.length, calls: callsData.rows.length };

  const requested = search.get("view");
  const view = CLIENT_VIEWS.some((v) => v.value === requested) ? requested : "leads";
  const setView = (value) => {
    const next = new URLSearchParams(search.toString());
    if (value === "leads") next.delete("view");
    else next.set("view", value);
    router.replace(`${pathname}?${next.toString()}`);
  };

  // One thread per table, so a conversation started on Leads does not carry into Calls.
  const chat = useAgentChat({
    sessionKey: `by_ops_ask_${view}_${clientId}`,
    client: client && isActive(client) ? { id: client.id, name: client.name } : null,
  });
  const [asking, setAsking] = useState(false);

  const rangeLabel = sentence((DATE_PRESETS.find((p) => p.value === datePreset) ?? DATE_PRESETS.find((p) => p.value === DEFAULT_DATE_PRESET)).label);
  const subtitle = client ? <>Scoped to <b className="font-semibold text-by-text">{client.name}</b> · {STATUS_WORDS[statusOf(client)]}</> : "One client";
  const current = CLIENT_VIEWS.find((v) => v.value === view);

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col bg-by-canvas font-by-body text-by-body text-by-text selection:bg-by-accent-line selection:text-by-text">
        <SectionHeader
          section={OPS}
          subtitle={subtitle}
          tabs={tabs}
          tab="dashboard"
          onTabChange={(value) => value !== "dashboard" && router.push(opsTabHref(value, search))}
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
              items={CLIENT_VIEWS.map((v) => ({ value: v.value, label: v.label, count: client ? counts[v.value] : undefined }))}
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
              <AdsTable data={tables.ads} cplTarget={client.targets?.cpl ?? null} currencySymbol={currencySymbol} />
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
            <Button kind="ghost" size="sm" onClick={() => router.push(`/dashboard/chat?client=${encodeURIComponent(clientId)}&c=${encodeURIComponent(chat.sessionId)}`)}>
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
