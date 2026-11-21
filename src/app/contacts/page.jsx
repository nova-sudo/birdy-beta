import { redirect } from "next/navigation";
import { leadsHubRedirect } from "@/lib/leads-hub";

// The Leads hub is retired: leads live in Media Buyer's table at its Leads level and in each
// client's Leads table. The address stays so old links and bookmarks still land somewhere.
export default async function ContactsPage({ searchParams }) {
  redirect(leadsHubRedirect(await searchParams));
}
