import { Suspense } from "react";
import { SetupPage } from "@/components/agency/setup/setup-page";

/** Setup: Birdy, then Media Buyer, then Sales Coach. `?s=` picks the section. */
export default function WelcomePage() {
  return (
    <Suspense fallback={null}>
      <SetupPage />
    </Suspense>
  );
}
