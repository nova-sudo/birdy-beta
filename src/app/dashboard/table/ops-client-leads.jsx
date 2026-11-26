"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Users } from "lucide-react";
import { Button, Card, EmptyState, Notice, SectionHeader, Skeleton } from "@/components/by";
import { LeadsContent } from "@/components/contacts/LeadsContent";
import { OPS_SECTION } from "@/components/agency/sections";
import { sectionTabHref, useSectionTabs } from "@/components/agency/tabs";
import { SectionMore } from "@/components/agency/section-more";
import { AskDock, PAGE, RangeMenu, scopedSubtitle, useAddressRange, useRangeGroups, useSectionChat } from "@/components/agency/section-parts";
import { pdFontClass } from "@/lib/pd-fonts";
import { useClientGroupsWithSeries } from "@/lib/useClientGroupsWithSeries";

// The table's state and where each piece sits in the address. Lists repeat their key.
const ONE = { tab: "leads", pipeline: "pipeline", stage: "stage", page: "page", type: "type", opportunity: "opportunity" };
const MANY = { sources: "source", tags: "tag" };

/**
 * Agency Ops' Dashboard tab inside one client (`?client=<id>`): the old Leads hub table, limited
 * to the client, under Agency Ops' header with its tabs and date range (`?range=`), and the ask
 * bar under it, its questions limited to the client.
 *
 * The tabs are the lead's stages (All, Meta lead, In CRM, Called, Closed, Lost); the CRM's
 * pipeline and stage are in Filters. The tab, the filters and the page are in the address
 * (`leads`, `pipeline`, `stage`, `source`, `type`, `opportunity`, `tag`, `page`), so Back from a
 * lead returns to the same place.
 *
 * @param {string} props.clientId
 */
export function OpsClientLeads({ clientId }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const address = search.toString();
  const section = OPS_SECTION;
  const tabs = useSectionTabs(section);
  const range = useAddressRange();
  const { clientGroups, loading, error, refresh } = useRangeGroups(useClientGroupsWithSeries, range.preset);
  const client = useMemo(() => clientGroups.find((g) => g.id === clientId) ?? null, [clientGroups, clientId]);
  const scope = useMemo(() => (client ? [client] : []), [client]);
  const chat = useSectionChat(section, "ask_leads", client);

  const query = useMemo(() => {
    const params = new URLSearchParams(address);
    const state = {};
    for (const [key, param] of Object.entries(ONE)) state[key] = params.get(param);
    for (const [key, param] of Object.entries(MANY)) state[key] = params.getAll(param);
    return state;
  }, [address]);

  const onQuery = useCallback(
    (changes) => {
      const next = new URLSearchParams(address);
      for (const [key, value] of Object.entries(changes)) {
        const param = ONE[key] ?? MANY[key];
        if (!param) continue;
        next.delete(param);
        for (const v of Array.isArray(value) ? value : value == null || value === "" ? [] : [value]) next.append(param, String(v));
      }
      const q = next.toString();
      router.replace(q ? `${pathname}?${q}` : pathname);
    },
    [address, pathname, router],
  );

  let body;
  if (error) {
    body = <Notice tone="danger" action={<Button size="sm" onClick={() => refresh()}>Retry</Button>}>Couldn’t load this client. Check your connection and try again.</Notice>;
  } else if (loading) {
    body = <Card aria-busy="true" aria-label="Loading the table" className="px-5 py-5"><Skeleton className="w-48" /><Skeleton className="mt-4 h-40 w-full rounded-by-md" /></Card>;
  } else if (!client) {
    body = <Card><EmptyState icon={<Users />} title="This client isn’t in your account">It may have been removed. Pick another from the switcher at the top of the rail.</EmptyState></Card>;
  } else {
    body = (
      <LeadsContent
        clientGroups={scope}
        groupsLoading={loading}
        datePreset={range.preset}
        showStatCards={false}
        selectedClientGroup={client.id}
        stages="lead"
        query={query}
        onQuery={onQuery}
        fill
      />
    );
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
        placeholder={client ? `Ask ${section.kit.name} about ${client.name}’s leads` : `Ask ${section.kit.name}`}
      >
        {/* Full width. Nothing here scrolls but the table inside its card. */}
        <div className={`${pdFontClass} flex min-h-0 w-full flex-1 flex-col px-7 pt-6 pb-3`}>{body}</div>
      </AskDock>
    </div>
  );
}
