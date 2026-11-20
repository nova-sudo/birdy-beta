import { Suspense } from "react";
import { BirdsEye } from "@/components/agency/birds-eye";

// Agency Ops opens on Bird's Eye. The page reads the client and the date range
// from the address, which needs a Suspense boundary.
export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <BirdsEye />
    </Suspense>
  );
}
