import Link from "next/link"
// Server component: import ds parts by file, since the barrel pulls in client-only code that breaks prerender.
import { Button } from "@/components/ds/primitives/button"
import { EmptyState } from "@/components/ds/surfaces/empty-state"

// Shown for any address that isn't a page. Next's default 404 rendered inside
// the app shell as near-invisible white text, which read as a broken app rather
// than a wrong address.
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <EmptyState
        icon={<span className="text-sm font-semibold text-primary">404</span>}
        title="This page doesn't exist"
        description="The address may be mistyped, or the page may have moved."
        action={
          <Button asChild variant="primary">
            <Link href="/dashboard">Go to the dashboard</Link>
          </Button>
        }
      />
    </div>
  )
}
