"use client";

// Standalone shell for the internal Admin console. Deliberately does NOT use
// the main app sidebar/header — the root layout bare-renders /admin paths
// (see src/app/layout.jsx) and this shell supplies its own dark rail + topbar
// so the console reads as a separate internal tool.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, MessageSquare, BarChart3, Coins, Percent, ArrowLeft, UserRound } from "lucide-react";
import Birdy from "@/components/birdy/Birdy";
import { useBirdy } from "@/components/birdy/use-birdy";

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
      className="flex w-16 shrink-0 flex-col items-center gap-2 bg-[#1E1A2E] py-4"
    >
      <Link
        href="/admin/agencies"
        className="mb-3 flex h-9 w-9 items-end justify-center overflow-hidden rounded-full border border-white/15 bg-white/10"
        aria-label="Birdy admin home"
      >
        <Birdy state={birdyState} size={30} speedK={1.15} />
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
            className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${
              active
                ? "bg-white/12 text-white"
                : "text-[#8A83A6] hover:bg-white/5 hover:text-white"
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
    <header className="flex h-15 shrink-0 items-center gap-3 border-b border-[#ECECF2] bg-white px-6">
      <h1 className="text-lg font-bold text-[#1F1B33]">Admin</h1>
      <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-amber-100">
        Internal
      </span>

      <div className="ml-auto flex items-center gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#ECECF2] px-3 py-1.5 text-sm font-semibold text-[#5A5A6E] transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Birdy
        </Link>
        <span
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2A2440] text-white"
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
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[#F7F7FB]">
      <AdminRail pathname={pathname} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar />
        <main className="flex-1 overflow-y-auto px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
