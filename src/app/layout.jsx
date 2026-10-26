"use client";

import "./globals.css";
import { fontVariables } from "@/lib/fonts";
import { MotionConfig } from "framer-motion";
import ProtectedLayout from '../components/ProtectedLayout';
import SWRProvider from "@/components/swr-provider";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Tag } from 'lucide-react';
import { APP_VERSION } from "@/lib/changelog";
import { ASK_BIRDY_EVENT } from "@/lib/ask-birdy";
// The assistant drags in the two heaviest libraries in the app — recharts for
// its inline charts and react-markdown for its replies. Imported eagerly, they
// landed in the shared layout chunk, so every route paid 615kB for them: the
// dashboard, the settings page, and the login screen, which has no assistant
// on it at all.
//
// Dynamic alone wouldn't have been enough. The modal is always in the tree,
// closed, so an ssr:false import would still fetch the chunk on every page
// once hydrated — just later. It is mounted only while open below, so the
// chunk is fetched the first time someone actually asks Birdy something.
const BirdyChatModal = dynamic(() => import("@/components/chat/BirdyChatModal"), {
  ssr: false,
});
import BirdyDefs from "@/components/birdy/BirdyDefs";
import ImpersonationBar from "@/components/ImpersonationBar";
import {
  AppSidebar,
  CommandSearch,
  ConfirmHost,
  MobileNavSheet,
  PageCard,
  Toaster,
  TopBar,
} from "@/components/ds";
import { CreditsProvider } from "@/hooks/useCredits";
import { DashboardControlsProvider } from "@/components/dashboard-controls";
import { PageHeaderProvider, useHasPageHeader } from "@/components/page-header";

const SIDEBAR_COLLAPSED_KEY = "birdy.sidebarCollapsed";

/**
 * The wordmark and version badge, which stand down whenever a page has put its
 * own title in the bar. It reads that from context, so it has to be a child of
 * the provider rather than part of RootLayout, which renders it.
 */
function BirdyWordmark() {
  return (
    <span className="flex items-center gap-2">
      <span className="text-lg font-semibold leading-none">Birdy</span>
      <Link
        href="/changelog"
        aria-label={`What's new in Birdy — version ${APP_VERSION}`}
        title={`What's new — ${APP_VERSION}`}
        className="inline-flex items-center gap-1 rounded-sm bg-neutral-soft px-2 py-0.5 text-xs font-medium text-neutral-ink outline-none focus-visible:shadow-control-focus"
      >
        <Tag className="size-3" aria-hidden="true" />
        {APP_VERSION}
      </Link>
    </span>
  );
}

/** TopBar, with the wordmark as its title on pages that publish none. */
function ShellTopBar({ onMenuClick, onToggleSidebar, onSearch }) {
  const hasPageHeader = useHasPageHeader();

  return (
    <TopBar
      title={hasPageHeader ? undefined : <BirdyWordmark />}
      onMenuClick={onMenuClick}
      onToggleSidebar={onToggleSidebar}
      onSearch={onSearch}
    />
  );
}

export default function RootLayout({ children }) {
  const pathname = usePathname();
  // /admin runs as a separate app-shell (its own rail + topbar via
  // src/app/admin/layout.jsx), so it opts out of the main sidebar/header here.
  //
  // An OAuth callback on its way back to the wizard is deliberately NOT
  // handled here. This shell is prerendered into the static /settings
  // document, so it has already painted by the time any of this runs — the
  // hand-off is caught in proxy.js instead, before the page is served at all.
  const hideSidebar =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/" ||
    pathname === "/onboarding" ||
    // The forwardable install page is opened by people outside the account —
    // a sidebar and an account header would be meaningless to them.
    pathname.startsWith("/install") ||
    pathname.startsWith("/admin");

  const [chatOpen, setChatOpen] = useState(false);
  const [chatInitialMsg, setChatInitialMsg] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // The width animates only once someone toggles it, so restoring a saved
  // rail on load does not slide 256 → 56 in front of them.
  const [sidebarAnimated, setSidebarAnimated] = useState(false);

  // The rail choice survives reloads. Read after mount so the server render
  // (always expanded) and the first client render agree.
  useEffect(() => {
    try {
      if (localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1") setSidebarCollapsed(true);
    } catch {
      // Storage blocked: start expanded.
    }
  }, []);

  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarAnimated(true);
    setSidebarCollapsed(next);
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
    } catch {
      // Storage blocked: the toggle still works for this visit.
    }
  };

  // Pages open the assistant by announcing a question rather than by reaching
  // into this component's state — see lib/ask-birdy.js for why.
  useEffect(() => {
    const onAsk = (e) => {
      const msg = e.detail?.message?.trim();
      if (!msg) {
        // openBirdyChat(): just show the modal — the transcript (including a
        // reply that finished while it was closed) is already in chat-store.
        if (e.detail?.open) setChatOpen(true);
        return;
      }
      setChatInitialMsg(msg);
      setChatOpen(true);
    };
    window.addEventListener(ASK_BIRDY_EVENT, onAsk);
    return () => window.removeEventListener(ASK_BIRDY_EVENT, onAsk);
  }, []);

  // ⌘K / Ctrl+K opens search, ⌘J / Ctrl+J opens the assistant. Neither fires
  // while the chat modal is open, and neither exists on the shell-less routes.
  useEffect(() => {
    if (hideSidebar) return;
    const onKey = (e) => {
      if (!(e.metaKey || e.ctrlKey) || chatOpen) return;
      const key = e.key.toLowerCase();
      if (key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      } else if (key === "j") {
        e.preventDefault();
        setSearchOpen(false);
        setChatOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chatOpen, hideSidebar]);

  // A route change (link click, back button) always leaves the mobile sheet shut.
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  const openSearch = () => {
    setNavOpen(false);
    setSearchOpen(true);
  };

  return (
    <html lang="en" suppressHydrationWarning className={fontVariables}>
      <head />
      <body suppressHydrationWarning className="antialiased">
        <BirdyDefs />
        <MotionConfig reducedMotion="user">
        <SWRProvider>
        <ProtectedLayout>
          <>
            {!hideSidebar && (
              <CreditsProvider>
              <DashboardControlsProvider>
              <PageHeaderProvider>
              <div className="flex h-screen w-full flex-col overflow-hidden bg-frame font-sans">
                {/* Impersonation banner (shows only while an admin is impersonating) */}
                <ImpersonationBar />
                <div className="flex min-h-0 flex-1">
                  <AppSidebar
                    onSearch={openSearch}
                    collapsed={sidebarCollapsed}
                    animated={sidebarAnimated}
                    className="hidden md:flex"
                  />
                  {/* The top bar sits on the canvas; the page is the white card
                      below it, with an 8px gutter right and bottom on desktop. */}
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                    <ShellTopBar
                      onMenuClick={() => setNavOpen(true)}
                      onToggleSidebar={toggleSidebar}
                      onSearch={openSearch}
                    />
                    <PageCard>{children}</PageCard>
                  </div>
                </div>

                <MobileNavSheet
                  open={navOpen}
                  onOpenChange={setNavOpen}
                  sidebarProps={{ onSearch: openSearch }}
                />
                <CommandSearch open={searchOpen} onOpenChange={setSearchOpen} />

                {/* Birdy Chat Modal — mounted only while open, so its chunk
                    is fetched on first use rather than on every page load.
                    Nothing is lost on unmount: the transcript lives in
                    chat-store, which is why closing and reopening already
                    showed a reply that finished while it was shut. */}
                {chatOpen && (
                  <BirdyChatModal
                    open={chatOpen}
                    onOpenChange={(v) => {
                      setChatOpen(v);
                      if (!v) setChatInitialMsg("");
                    }}
                    initialMessage={chatInitialMsg}
                    pathname={pathname}
                  />
                )}
              </div>
              </PageHeaderProvider>
              </DashboardControlsProvider>
              </CreditsProvider>
            )}

            {hideSidebar && (
              <div className="w-full">
                {children}
              </div>
            )}
          </>
        </ProtectedLayout>
        </SWRProvider>
        </MotionConfig>
        <ConfirmHost />
        <Toaster />
      </body>
    </html>
  );
}
