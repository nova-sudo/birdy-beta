import { redirect } from "next/navigation";

// Credits live on the billing hub now, next to the plan they come with. The
// route stays so old links and Whop's top-up return URL still land somewhere,
// carrying the ?topup=success flag the hub listens for.
export default async function CreditsPage({ searchParams }) {
  const params = await searchParams;
  redirect(params?.topup ? `/billing?topup=${encodeURIComponent(params.topup)}` : "/billing");
}
