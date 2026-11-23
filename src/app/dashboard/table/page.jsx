import { redirect } from "next/navigation";

// Birdy no longer has a separate Dashboard tab: /dashboard is its dashboard
// now. Old links land there, keeping the client and the date range.
export default async function AgencyDashboardRedirect({ searchParams }) {
  const params = await searchParams;
  const keep = new URLSearchParams();
  for (const key of ["client", "range"]) {
    const value = params?.[key];
    if (typeof value === "string" && value) keep.set(key, value);
  }
  const query = keep.toString();
  redirect(query ? `/dashboard?${query}` : "/dashboard");
}
