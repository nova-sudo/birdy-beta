"use client";

// Standalone shell for the internal Admin console. Deliberately does NOT use
// the main app sidebar/header — the root layout bare-renders /admin paths
// (see src/app/layout.jsx) and this shell supplies its own dark rail + topbar
// so the console reads as a separate internal tool.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, MessageSquare, BarChart3, Coins, Percent, ArrowLeft, UserRound } from "lucide-react";
import BirdyAvatar from "@/components/birdy/BirdyAvatar";
import { useBirdy } from "@/components/birdy/use-birdy";
import { Button } from "@/components/ui/button";

const NAV = [
  { label: "Agencies", href: "/admin/agencies", Icon: Users },
  { label: "AI queries", href: "/admin/ai-queries", Icon: MessageSquare },
  { label: "Credits", href: "/admin/credits", Icon: Coins },
  { label: "Promo Codes", href: "/admin/promo-codes", Icon: Percent },
  { label: "Stats", href: "/admin/stats", Icon: BarChart3 },
];

function AdminRail({ pathname }) {
  const { state: birdyState } = useBirdy();
  return (
    <nav
      aria-label="Admin sections"
      className="flex w-16 shrink-0 flex-col items-center gap-2 border-r border-white/10 bg-pd-ink py-4"
    >
      <Link
        href="/admin/agencies"
        className="mb-3 flex rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-white/25"
        aria-label="Birdy admin home"
      >
        <BirdyAvatar size={36} tone="white" state={birdyState} speedK={1.15} />
      </Link>

      {NAV.map(({ label, href, Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            title={label}
            className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-white/25 ${
              active
                ? "bg-white/10 text-white"
                : "text-white/70 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Icon className="h-[19px] w-[19px]" aria-hidden="true" />
          </Link>
        );
      })}
    </nav>
  );
}

function AdminTopbar() {
  return (
    <header className="flex h-15 shrink-0 items-center gap-3 border-b border-pd-border bg-pd-surface px-6">
      <h1 className="font-pd-display text-lg font-bold text-pd-ink">Admin</h1>
      <span className="rounded-full bg-pd-warning-bg px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-pd-amber">
        Internal
      </span>

      <div className="ml-auto flex items-center gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard">
            <ArrowLeft aria-hidden="true" />
            Back to Birdy
          </Link>
        </Button>
        <span
          className="flex h-9 w-9 items-center justify-center rounded-full bg-pd-ink text-white"
          aria-hidden="true"
        >
          <UserRound className="h-5 w-5" />
        </span>
      </div>
    </header>
  );
}

export default function AdminShell({ children }) {
  const pathname = usePathname();

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-pd-canvas">
      <AdminRail pathname={pathname} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar />
        <main className="flex-1 overflow-y-auto px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
