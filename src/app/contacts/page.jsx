import { redirect } from "next/navigation";
import { leadsHubRedirect } from "@/lib/leads-hub";

// The Leads hub is retired: leads live on Media Buyer's Dashboard, on its Leads tab. The address
// stays so old links and bookmarks still land somewhere.
export default async function ContactsPage({ searchParams }) {
  redirect(leadsHubRedirect(await searchParams));
}
