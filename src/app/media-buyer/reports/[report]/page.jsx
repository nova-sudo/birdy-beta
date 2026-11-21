import { Suspense } from "react";
import { ReportsTab } from "@/components/agency/reports-tab";

// One of the Media Buying Agent's reports: "morning" or "weekly".
export default async function MediaBuyerReportPage({ params }) {
  const { report } = await params;
  return (
    <Suspense fallback={null}>
      <ReportsTab section="buyer" reportId={decodeURIComponent(report)} />
    </Suspense>
  );
}
