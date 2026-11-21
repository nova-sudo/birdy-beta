import { Suspense } from "react";
import { SettingsScreen } from "@/components/agency/settings/settings-screen";

export const metadata = { title: "Settings · Birdy" };

export default function SettingsPage() {
  // Reading the address's ?section= needs a Suspense boundary.
  return (
    <Suspense>
      <SettingsScreen />
    </Suspense>
  );
}
