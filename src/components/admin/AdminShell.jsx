"use client";

// Standalone shell for the internal Admin console. Deliberately does NOT use
// the main app nav/header — the root layout bare-renders /admin paths
// (see src/app/layout.jsx) and this shell supplies its own rail + topbar so
// the console reads as a separate internal tool. It is built from the same ds
// shell pieces as the app (canvas, borderless 52 top bar, page card), with its
// own nav and a minimal top bar: no assistant, search or bell.

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, BarChart3, Coins, MessageSquare, Percent, Users } from "lucide-react";
import { AppSidebar, Badge, Button, MobileNavSheet, PageCard, TopBar } from "@/components/ds";

export const ADMIN_NAV = [
  { key: "agencies", label: "Agencies", href: "/admin/agencies", icon: Users },
  { key: "ai-queries", label: "AI queries", href: "/admin/ai-queries", icon: MessageSquare },
  { key: "credits", label: "Credits", href: "/admin/credits", icon: Coins },
  { key: "promo-codes", label: "Promo Codes", href: "/admin/promo-codes", icon: Percent },
  { key: "stats", label: "Stats", href: "/admin/stats", icon: BarChart3 },
];

const SIDEBAR_PROPS = { items: ADMIN_NAV, agencyName: "Admin", minimal: true };

const ADMIN_TITLE = (
  <span className="flex min-w-0 items-center gap-2">
    <h1 className="truncate text-base font-semibold">Admin</h1>
    <Badge variant="soft" tone="warning">
      Internal
    </Badge>
  </span>
);

const BACK_TO_BIRDY = (
  <Button asChild variant="outline" size="sm">
    <Link href="/dashboard">
      <ArrowLeft aria-hidden="true" />
      Back to Birdy
    </Link>
  </Button>
);

export default function AdminShell({ children }) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-frame font-sans">
      <AppSidebar {...SIDEBAR_PROPS} className="hidden md:flex" />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <TopBar minimal title={ADMIN_TITLE} actions={BACK_TO_BIRDY} onMenuClick={() => setNavOpen(true)} />
        <PageCard>{children}</PageCard>
      </div>
      <MobileNavSheet open={navOpen} onOpenChange={setNavOpen} sidebarProps={SIDEBAR_PROPS} />
    </div>
  );
}
