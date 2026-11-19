"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Calendar, MessageSquare, Users } from "lucide-react";
import {
  AskBar, AskPanel, Button, Card, DropdownTrigger, EmptyState, Menu, MenuContent, MenuItem, MenuTrigger, Notice, SECTIONS, SectionHeader, Skeleton, TabPill,
} from "@/components/by";
import { ChatThread } from "@/components/agency/chat/thread";
import { useAgentChat } from "@/components/agency/chat/use-agent-chat";
import { opsTabHref, useOpsTabs } from "@/components/agency/tabs";
// The three tables are the hubs' own, shown for one client the way the older client page shows them.
import { CallCentreContent } from "@/components/callcenter/CallCentreContent";
import { MarketingContent } from "@/components/campaigns/MarketingContent";
import { LeadsContent } from "@/components/contacts/LeadsContent";
import { isActive } from "@/lib/client-status";
import { statusOf } from "@/lib/clients-list";
import { DATE_PRESETS, DEFAULT_DATE_PRESET } from "@/lib/constants";
import { pdFontClass } from "@/lib/pd-fonts";
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
 * tables, each with the hub's own tabs and columns, and the ask bar. Every
 * question asked here is limited to this client.
 *
 * @param {string} props.clientId
 */
export function ClientDashboard({ clientId }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const tabs = useOpsTabs();
  const { clientGroups, loading, error, datePreset, setDatePreset, refresh, invalidate } = useClientGroupsWithSeries(DEFAULT_DATE_PRESET);
  const client = useMemo(() => clientGroups.find((g) => g.id === clientId) ?? null, [clientGroups, clientId]);
  const only = useMemo(() => (client ? [client] : []), [client]);

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

        <div className="shrink-0 px-7 pt-4.5">
          <TabPill aria-label={client ? `${client.name}'s tables` : "Tables"} items={CLIENT_VIEWS} value={view} onValueChange={setView} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-7 pt-3.5 pb-4">
          {error ? (
            <Notice tone="danger" action={<Button size="sm" onClick={() => refresh()}>Retry</Button>}>Couldn’t load this client. Check your connection and try again.</Notice>
          ) : loading ? (
            <Card aria-busy="true" aria-label="Loading the table" className="px-5 py-5"><Skeleton className="w-48" /><Skeleton className="mt-4 h-40 w-full rounded-by-md" /></Card>
          ) : !client ? (
            <Card><EmptyState icon={<Users />} title="This client isn’t in your account">It may have been removed. Pick another from the switcher at the top of the rail.</EmptyState></Card>
          ) : (
            // The hub tables are built on the older kit and bring its fonts and colours with them.
            <div className={pdFontClass}>
              {view === "leads" && (
                // Scoped explicitly: left to default it asks for every client's leads.
                <LeadsContent clientGroups={only} groupsLoading={loading} datePreset={datePreset} showStatCards={false} selectedClientGroup={client.id} />
              )}
              {view === "ads" && (
                <MarketingContent clientGroups={only} groupsLoading={loading} groupsError={error} datePreset={datePreset} setDatePreset={setDatePreset} showGroupFilter={false} showHeader={false} onCacheInvalidate={invalidate} />
              )}
              {view === "calls" && (
                <CallCentreContent clientGroups={only} groupsLoading={loading} datePreset={datePreset} showGroupFilter={false} showStatCards={false} onCallCentreChanged={refresh} />
              )}
            </div>
          )}
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
