import { redirect } from "next/navigation";
import { leadsHubRedirect } from "@/lib/leads-hub";

// The Leads hub's table is Agency Ops' Dashboard tab now. The address stays so old links and
// bookmarks still land there.
export default async function ContactsPage({ searchParams }) {
  redirect(leadsHubRedirect(await searchParams));
}
