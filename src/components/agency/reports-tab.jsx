"use client";

import { SectionPage } from "@/components/agency/section-page";
import { resolveSection } from "@/components/agency/sections";
import { SlackReportPage, SlackReportsList, reportScope } from "@/components/agency/reports-slack";
import { AGENT_REPORT_KEYS, AgentReportPage, AgentReportsList } from "@/components/agency/reports-agent";

/**
 * A section's Reports, under "More". Every section lists its own agent's Slack reports (owner
 * "birdy", "media_buyer" or "sales_coach") with the same list, New report and report page.
 * Marketing Guru's list also starts with its Media Buying Agent's morning and weekly reports.
 *
 * @param {"ops"|"buyer"|"coach"} props.section
 * @param {string} [props.reportId] one report's page; the list without it
 */
export function ReportsTab({ section: which, reportId = null }) {
  const section = resolveSection(which);
  const name = section.kit.name;
  const scope = reportScope(section);
  return (
    <SectionPage section={section} tab="reports" placeholder={`Ask ${name} about your clients`}>
      {(client) => {
        if (section.key === "buyer") {
          if (!reportId) return <AgentReportsList client={client} />;
          if (AGENT_REPORT_KEYS.includes(reportId)) return <AgentReportPage reportKey={reportId} />;
        }
        return reportId ? <SlackReportPage reportId={reportId} scope={scope} /> : <SlackReportsList scope={scope} />;
      }}
    </SectionPage>
  );
}
