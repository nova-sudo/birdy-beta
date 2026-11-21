import { redirect } from "next/navigation";
import { sectionRedirect } from "@/lib/settings-sections";

// Alerts lives in Settings now. The address stays so old links and bookmarks
// (and ?tab=triggered from the notifications bell) still land there.
export default async function AlertsPage({ searchParams }) {
  redirect(sectionRedirect("alerts", await searchParams));
}
