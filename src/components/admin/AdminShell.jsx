"use client";

// Standalone shell for the internal Admin console. Deliberately does NOT use
// the main app nav/header — the root layout bare-renders /admin paths
// (see src/app/layout.jsx) and this shell supplies its own rail + topbar so
// the console reads as a separate internal tool. It is built from the same ds
// shell pieces as the app, with its own nav.

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, BarChart3, Coins, Menu, MessageSquare, Percent, Users } from "lucide-react";
import { AppSidebar, Badge, Button, MobileNavSheet } from "@/components/ds";

export const ADMIN_NAV = [
  { key: "agencies", label: "Agencies", href: "/admin/agencies", icon: Users },
  { key: "ai-queries", label: "AI queries", href: "/admin/ai-queries", icon: MessageSquare },
  { key: "credits", label: "Credits", href: "/admin/credits", icon: Coins },
  { key: "promo-codes", label: "Promo Codes", href: "/admin/promo-codes", icon: Percent },
  { key: "stats", label: "Stats", href: "/admin/stats", icon: BarChart3 },
];

const SIDEBAR_PROPS = { items: ADMIN_NAV, agencyName: "Admin", minimal: true };

function AdminTopbar({ onMenuClick }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-3 md:px-6">
      <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation" onClick={onMenuClick}>
        <Menu />
      </Button>
      <h1 className="text-base font-semibold">Admin</h1>
      <Badge variant="soft" tone="warning">
        Internal
      </Badge>

      <div className="ml-auto flex items-center">
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard">
            <ArrowLeft aria-hidden="true" />
            Back to Birdy
          </Link>
        </Button>
      </div>
    </header>
  );
}

export default function AdminShell({ children }) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="grid h-[100dvh] w-full grid-cols-1 overflow-hidden bg-frame font-sans md:grid-cols-[auto_minmax(0,1fr)]">
      <AppSidebar {...SIDEBAR_PROPS} className="hidden md:flex" />
      <div className="min-h-0 min-w-0 md:py-2 md:pr-2">
        <div className="flex h-full min-w-0 flex-col overflow-hidden bg-background md:rounded-frame md:shadow-surface">
          <AdminTopbar onMenuClick={() => setNavOpen(true)} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
        </div>
      </div>
      <MobileNavSheet open={navOpen} onOpenChange={setNavOpen} sidebarProps={SIDEBAR_PROPS} />
    </div>
  );
}
