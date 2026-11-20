import { Suspense } from "react";
import { SectionDashboard } from "@/components/agency/section-dashboard";

// Media Buyer's Dashboard tab: the section's table with the ask bar.
export default function MediaBuyerDashboardPage() {
  return (
    <Suspense fallback={null}>
      <SectionDashboard section="buyer" />
    </Suspense>
  );
}
