import { Suspense } from "react";
import { SectionBirdsEye } from "@/components/agency/section-birds-eye";

// Media Buyer opens on Bird's Eye. The page reads the client and the date range
// from the address, which needs a Suspense boundary.
export default function MediaBuyerPage() {
  return (
    <Suspense fallback={null}>
      <SectionBirdsEye section="buyer" />
    </Suspense>
  );
}
