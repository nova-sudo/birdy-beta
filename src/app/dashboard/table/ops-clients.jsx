"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { SectionHeader } from "@/components/by";
import { OldClientsTable } from "@/components/clients/list/old-clients-table";
import { OPS_SECTION } from "@/components/agency/sections";
import { sectionTabHref, useSectionTabs } from "@/components/agency/tabs";
import { SectionMore } from "@/components/agency/section-more";
import { AskDock, PAGE, useSectionChat } from "@/components/agency/section-parts";

/**
 * Agency Ops' Dashboard tab: the Clients table, the same one the Clients page shows, under
 * Agency Ops' header and tabs. The table keeps its own date range, as it does on the Clients page.
 */
export function OpsClientsDashboard() {
  const router = useRouter();
  const search = useSearchParams();
  const section = OPS_SECTION;
  const tabs = useSectionTabs(section);
  const chat = useSectionChat(section, "ask_table", null);

  return (
    <OldClientsTable
      frame={({ dateRange, body }) => (
        <div className={PAGE}>
          <SectionHeader
            section={section.kit}
            tabs={tabs}
            tab="dashboard"
            more={<SectionMore section={section} tab="dashboard" />}
            onTabChange={(value) => value !== "dashboard" && router.push(sectionTabHref(section, value, search))}
            dateRange={dateRange}
          />
          <AskDock section={section} chat={chat} floating={false} placeholder={`Ask ${section.kit.name} about your clients`}>
            {body}
          </AskDock>
        </div>
      )}
    />
  );
}
