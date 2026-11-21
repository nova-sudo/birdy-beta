import { redirect } from "next/navigation";
import { sectionRedirect } from "@/lib/settings-sections";

// Credits live in Settings › Plan & credits now. The address stays so old
// links and Whop's top-up return URL (?topup=success) still land there.
export default async function CreditsPage({ searchParams }) {
  redirect(sectionRedirect("plan", await searchParams));
}
