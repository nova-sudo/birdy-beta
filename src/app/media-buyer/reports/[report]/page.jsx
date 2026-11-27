import { Suspense } from "react";
import { ReportsTab } from "@/components/agency/reports-tab";

// One of Marketing Guru's reports: its agent's "morning" or "weekly", or one of its Slack reports.
export default async function MediaBuyerReportPage({ params }) {
  const { report } = await params;
  return (
    <Suspense fallback={null}>
      <ReportsTab section="buyer" reportId={decodeURIComponent(report)} />
    </Suspense>
  );
}
