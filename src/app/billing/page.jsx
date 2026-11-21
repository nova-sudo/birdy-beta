import { redirect } from "next/navigation";
import { sectionRedirect } from "@/lib/settings-sections";

// Billing lives in Settings › Plan & credits now. The address stays so old
// links and Whop's return URLs (?checkout=success) still land there.
export default async function BillingPage({ searchParams }) {
  redirect(sectionRedirect("plan", await searchParams));
}
