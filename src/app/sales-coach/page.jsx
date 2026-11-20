import { Suspense } from "react";
import { SectionBirdsEye } from "@/components/agency/section-birds-eye";

// Sales Coach opens on Bird's Eye. The page reads the client and the date range
// from the address, which needs a Suspense boundary.
export default function SalesCoachPage() {
  return (
    <Suspense fallback={null}>
      <SectionBirdsEye section="coach" />
    </Suspense>
  );
}
