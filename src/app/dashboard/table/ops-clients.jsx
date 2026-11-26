"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { SectionHeader } from "@/components/by";
import { OldClientsTable } from "@/components/clients/list/old-clients-table";
import { OPS_SECTION } from "@/components/agency/sections";
import { sectionTabHref, useSectionTabs } from "@/components/agency/tabs";
import { SectionMore } from "@/components/agency/section-more";
import { AskDock, PAGE, useSectionChat } from "@/components/agency/section-parts";
import { OpsClientLeads } from "./ops-client-leads";

/**
 * Agency Ops' Dashboard tab. It follows the client picked in the rail's switcher: with none it is
 * the Clients table, the same one the Clients page shows, under Agency Ops' header and tabs (the
 * table keeps its own date range, as it does on the Clients page); with `?client=<id>` it is that
 * client's leads, in the old Leads hub table (see ops-client-leads).
 */
export function OpsClientsDashboard() {
  const clientId = useSearchParams().get("client");
  return clientId ? <OpsClientLeads key={clientId} clientId={clientId} /> : <AgencyClients />;
}

/** The Clients table, every client of the agency, with their health tabs. */
function AgencyClients() {
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
