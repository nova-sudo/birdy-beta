import { Suspense } from "react";
import { SectionDashboard } from "@/components/agency/section-dashboard";

// Sales Coach's Dashboard tab: the section's table with the ask bar.
export default function SalesCoachDashboardPage() {
  return (
    <Suspense fallback={null}>
      <SectionDashboard section="coach" />
    </Suspense>
  );
}
