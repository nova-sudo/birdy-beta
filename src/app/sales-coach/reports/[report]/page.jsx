import { Suspense } from "react";
import { ReportsTab } from "@/components/agency/reports-tab";

// One of Sales Coach's Slack reports.
export default async function SalesCoachReportPage({ params }) {
  const { report } = await params;
  return (
    <Suspense fallback={null}>
      <ReportsTab section="coach" reportId={decodeURIComponent(report)} />
    </Suspense>
  );
}
