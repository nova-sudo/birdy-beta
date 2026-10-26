import Link from "next/link"
import { Button, EmptyState } from "@/components/ds"

// Shown for any address that isn't a page. Next's default 404 rendered inside
// the app shell as near-invisible white text, which read as a broken app rather
// than a wrong address.
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <EmptyState
        icon={<span className="text-sm font-semibold text-primary">404</span>}
        titleAs="h1"
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
