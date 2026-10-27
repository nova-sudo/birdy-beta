import Link from "next/link"
import { Button } from "@/components/ui/button"

// Shown for any address that isn't a page. Next's default 404 rendered inside
// the app shell as near-invisible white text, which read as a broken app rather
// than a wrong address.
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="font-pd-display text-[13px] font-semibold text-pd-primary">404</p>
      <h1 className="font-pd-display text-[22px] font-semibold text-pd-ink">This page doesn&apos;t exist</h1>
      <p className="max-w-[360px] text-[13.5px] leading-[1.5] text-pd-muted">
        The address may be mistyped, or the page may have moved.
      </p>
      <Button asChild className="mt-2">
        <Link href="/dashboard">Go to the dashboard</Link>
      </Button>
    </div>
  )
}
