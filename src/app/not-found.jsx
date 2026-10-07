import Link from "next/link"

// Shown for any address that isn't a page. Next's default 404 rendered inside
// the app shell as near-invisible white text, which read as a broken app rather
// than a wrong address.
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-[13px] font-semibold text-pd-primary">404</p>
      <h1 className="font-pd-display text-[22px] font-semibold text-pd-ink">This page doesn&apos;t exist</h1>
      <p className="max-w-[360px] text-[13.5px] leading-[1.5] text-pd-muted">
        The address may be mistyped, or the page may have moved.
      </p>
      <Link
        href="/dashboard"
        className="mt-2 rounded-[10px] bg-pd-primary px-4 py-2 text-[13px] font-medium text-white hover:opacity-90"
      >
        Go to the dashboard
      </Link>
    </div>
  )
}
