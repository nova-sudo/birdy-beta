import { redirect } from "next/navigation";
import { sectionRedirect } from "@/lib/settings-sections";

// Metrics lives in Settings now. The address stays so old links and bookmarks
// still land there, query string and all.
export default async function MetricsPage({ searchParams }) {
  redirect(sectionRedirect("metrics", await searchParams));
}
