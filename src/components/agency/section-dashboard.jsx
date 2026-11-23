"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SectionHeader } from "@/components/by";
import { MarketingContent } from "@/components/campaigns/MarketingContent";
import { CallCentreContent } from "@/components/callcenter/CallCentreContent";
import { resolveSection } from "@/components/agency/sections";
import { sectionTabHref, useSectionTabs } from "@/components/agency/tabs";
import { SectionMore } from "@/components/agency/section-more";
import { pdFontClass } from "@/lib/pd-fonts";
import { useClientGroupsWithSeries } from "@/lib/useClientGroupsWithSeries";
import { AskDock, PAGE, RangeMenu, scopedSubtitle, useAddressRange, useRangeGroups, useSectionChat } from "./section-parts";

/**
 * Media Buyer's or Sales Coach's Dashboard tab: the old hub's table, as it is on the hub.
 *
 * Media Buyer draws the Marketing Hub's (`/campaigns`) Campaigns / Ad Sets / Ads / Leads / Creatives table with its
 * columns menu, saved views, search, filters and drill-down; Sales Coach the Sales Hub's (`/Sales-Hub`) call-centre
 * table with its tabs and filters. The client comes from the rail's switcher (`?client=`) and the range from the
 * header (`?range=`). The table scrolls inside its card; the header, the table's tabs and its toolbar stay put.
 *
 * @param {import("./sections").SectionConfig} props.section
 */
export function SectionDashboard({ section: which }) {
  const section = resolveSection(which);
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const tabs = useSectionTabs(section);
  const range = useAddressRange();
  const clientId = search.get("client") || null;
  const coach = section.key === "coach";

  // What the old hubs were handed: every client group for the range, with its per-day series.
  const { clientGroups, loading, error, refresh, invalidate } = useRangeGroups(useClientGroupsWithSeries, range.preset);
  const group = clientId ? clientGroups.find((g) => g.id === clientId) ?? null : null;
  const chat = useSectionChat(section, "ask_table", group);

  // The Sales Hub table narrows itself to a client (a row clicked on Overview, the chip's ×). Here that is the
  // address's client, the one the rail's switcher shows.
  const pickClient = (id) => {
    const next = new URLSearchParams(search.toString());
    if (!id || id === "all") next.delete("client");
    else next.set("client", id);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <div className={PAGE}>
      <SectionHeader
        section={section.kit}
        subtitle={scopedSubtitle(group)}
        tabs={tabs}
        tab="dashboard"
        more={<SectionMore section={section} tab="dashboard" />}
        onTabChange={(value) => value !== "dashboard" && router.push(sectionTabHref(section, value, search))}
        dateRange={<RangeMenu preset={range.preset} label={range.label} onPick={range.setPreset} />}
      />
      <AskDock section={section} chat={chat} floating={false} placeholder={`Ask ${section.kit.name} about ${section.askAbout}, or tell it what to change`}>
        {/* Full width. Nothing here scrolls but the table inside its card. */}
        <div className={`${pdFontClass} flex min-h-0 w-full flex-1 flex-col px-7 pt-6 pb-3`}>
          {coach ? (
            <CallCentreContent
              clientGroups={clientGroups}
              groupsLoading={loading}
              datePreset={range.preset}
              showGroupFilter
              showStatCards={false}
              selectedClientGroup={clientId ?? "all"}
              onSelectClientGroup={pickClient}
              onCallCentreChanged={refresh}
              fill
            />
          ) : (
            <MarketingContent
              part="table"
              clientGroups={clientGroups}
              groupsLoading={loading}
              groupsError={error}
              datePreset={range.preset}
              showGroupFilter={false}
              showHeader={false}
              selectedClientGroup={clientId}
              onCacheInvalidate={invalidate}
              fill
              hideCreatives
            />
          )}
        </div>
      </AskDock>
    </div>
  );
}
