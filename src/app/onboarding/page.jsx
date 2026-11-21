import { redirect } from "next/navigation"

/**
 * The old address of setup. Setup lives at /welcome now; this keeps links,
 * bookmarks and in-flight checkouts (Whop's return URL) working.
 */
export default async function OnboardingRedirect({ searchParams }) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries((await searchParams) || {})) {
    for (const v of [].concat(value)) params.append(key, v)
  }
  const query = params.toString()
  redirect(`/welcome${query ? `?${query}` : ""}`)
}
