"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SectionHeader } from "@/components/by";
import { LeadsContent } from "@/components/contacts/LeadsContent";
import { OPS_SECTION } from "@/components/agency/sections";
import { sectionTabHref, useSectionTabs } from "@/components/agency/tabs";
import { SectionMore } from "@/components/agency/section-more";
import { pdFontClass } from "@/lib/pd-fonts";
import { useClientGroupsWithSeries } from "@/lib/useClientGroupsWithSeries";
import { AskDock, PAGE, RangeMenu, scopedSubtitle, useAddressRange, useRangeGroups, useSectionChat } from "@/components/agency/section-parts";

/**
 * Agency Ops' Dashboard tab: the old Leads hub's table, as it was on the hub. Pipeline stage tabs,
 * search, filters, the Columns menu with saved views, and a row opens the lead.
 *
 * The date range is the header's (`?range=`) and the client is the rail's (`?client=`); the
 * table's own client chip writes the same address, so the whole section follows it.
 */
export function OpsLeadsDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const section = OPS_SECTION;
  const tabs = useSectionTabs(section);
  const range = useAddressRange();
  const clientId = search.get("client") || null;

  const { clientGroups, loading } = useRangeGroups(useClientGroupsWithSeries, range.preset);
  const group = clientId ? clientGroups.find((g) => g.id === clientId) ?? null : null;
  const chat = useSectionChat(section, "ask_table", group);

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
      <AskDock section={section} chat={chat} floating={false} placeholder={`Ask ${section.kit.name} about these leads`}>
        {/* Full width. Nothing here scrolls but the table inside its card. */}
        <div className={`${pdFontClass} flex min-h-0 w-full flex-1 flex-col px-7 pt-6 pb-3`}>
          <LeadsContent
            clientGroups={clientGroups}
            groupsLoading={loading}
            datePreset={range.preset}
            showStatCards={false}
            selectedClientGroup={clientId ?? "all"}
            onSelectClientGroup={pickClient}
            fill
          />
        </div>
      </AskDock>
    </div>
  );
}
