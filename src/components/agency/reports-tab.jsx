"use client";

import { SectionPage } from "@/components/agency/section-page";
import { resolveSection } from "@/components/agency/sections";
import { SlackReportPage, SlackReportsList } from "@/components/agency/reports-slack";
import { AgentReportPage, AgentReportsList } from "@/components/agency/reports-agent";

/**
 * A section's Reports, under "More". Birdy's are the account's Slack reports; Marketing Guru's are
 * its Media Buying Agent's morning and weekly reports. Sales Coach has no reports of its own, so it
 * has no Reports page (tabs.js).
 *
 * @param {"ops"|"buyer"} props.section
 * @param {string} [props.reportId] one report's page; the list without it
 */
export function ReportsTab({ section: which, reportId = null }) {
  const section = resolveSection(which);
  const name = section.kit.name;
  return (
    <SectionPage section={section} tab="reports" placeholder={`Ask ${name} about your clients`}>
      {(client) => {
        if (section.key === "buyer") return reportId ? <AgentReportPage reportKey={reportId} /> : <AgentReportsList client={client} />;
        return reportId ? <SlackReportPage reportId={reportId} /> : <SlackReportsList />;
      }}
    </SectionPage>
  );
}
