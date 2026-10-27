"use client";

import "./globals.css";
import { fontVariables } from "@/lib/pd-fonts";
import { MotionConfig } from "framer-motion";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import UserMenu from "@/components/UserMenu";
import ProtectedLayout from '../components/ProtectedLayout';
import SWRProvider from "@/components/swr-provider";
import { AppSidebar } from "@/components/app-sidebar";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { Search, Sparkles, Tag } from 'lucide-react';
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
import NotificationsDropdown from "@/components/NotificationsDropdown";
import ImpersonationBar from "@/components/ImpersonationBar";
import { Toaster } from "@/components/ui/sonner";
import { AgentRunBanner } from "@/components/agents/AgentRunBanner";
import { CreditsProvider } from "@/hooks/useCredits";
import {
  DashboardControlsProvider,
  DashboardHeaderControls,
  DashboardHeaderTitle,
} from "@/components/dashboard-controls";
import {
  PageHeaderControls,
  PageHeaderProvider,
  PageHeaderTitle,
  useHasPageHeader,
} from "@/components/page-header";

/**
 * The wordmark and version badge, which stand down whenever a page has put its
 * own title in the bar. It reads that from context, so it has to be a child of
 * the provider rather than part of RootLayout, which renders it.
 */
function BirdyWordmark() {
  const pathname = usePathname();
  const hasPageHeader = useHasPageHeader();

  // /dashboard publishes its title the older way (a route check in
  // dashboard-controls), so it is named here rather than detected.
  if (pathname === "/dashboard" || hasPageHeader) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="font-pd-display text-[20px] font-extrabold leading-none tracking-[-0.02em] text-pd-ink">Birdy</span>
      <Link
        href="/changelog"
        aria-label={`What's new in Birdy — version ${APP_VERSION}`}
        title={`What's new — ${APP_VERSION}`}
        className="rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/15"
      >
        <Badge
          variant="secondary"
          className="cursor-pointer gap-1 font-semibold transition-colors"
        >
          <Tag className="h-3 w-3" aria-hidden="true" />
          {APP_VERSION}
        </Badge>
      </Link>
    </div>
  );
}

export default function RootLayout({ children }) {
  const pathname = usePathname();
  // /admin runs as a separate app-shell (its own dark rail + topbar via
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
  const [headerInput, setHeaderInput] = useState("");
  const headerInputRef = useRef(null);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setIsMac(/Mac|iPhone|iPad|iPod/i.test(navigator.platform));
    }
  }, []);

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

  // ⌘K / Ctrl+K focuses the header search bar (only when chat modal is closed)
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k" && !chatOpen) {
        e.preventDefault();
        headerInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chatOpen]);

  const handleHeaderSubmit = (e) => {
    e.preventDefault();
    const msg = headerInput.trim();
    if (!msg) return;
    setChatInitialMsg(msg);
    setHeaderInput("");
    setChatOpen(true);
  };

  return (
    <html suppressHydrationWarning className={fontVariables}>
      <head />
      <body suppressHydrationWarning className="antialiased">
        <BirdyDefs />
        <MotionConfig reducedMotion="user">
        <SWRProvider>
        <ProtectedLayout>
          <SidebarProvider open={false}>
            {!hideSidebar && (
              <CreditsProvider>
              <DashboardControlsProvider>
              <PageHeaderProvider>
              <div className="flex h-screen w-full overflow-hidden">
                <AppSidebar />
                <div className="flex flex-col flex-1 min-w-0">
                  {/* Impersonation banner (shows only while an admin is impersonating) */}
                  <ImpersonationBar />
                  {/* An agent that couldn't run because Meta needs reconnecting */}
                  <AgentRunBanner />
                  {/* Top Header */}
                  <header className="bg-background border-b border-pd-border w-full z-50 flex items-center justify-between px-4 py-2 h-15 shrink-0">
                    <div className="flex items-center gap-2">
                      <SidebarTrigger className="md:hidden" />
                      {/* The dashboard puts its own title here instead of the
                          wordmark — the page no longer carries one. */}
                      <DashboardHeaderTitle />
                      <PageHeaderTitle />
                      <BirdyWordmark />
                    </div>

                    {/* Center Ask-Birdy search bar */}
                    <div className="mx-auto flex-1 flex justify-center max-w-2xl px-4">
                      <form onSubmit={handleHeaderSubmit} className="relative w-full max-w-md group">
                        <Sparkles className="absolute top-1/2 -translate-y-1/2 left-3.5 h-4 w-4 text-pd-primary pointer-events-none" />
                        <input
                          ref={headerInputRef}
                          value={headerInput}
                          onChange={(e) => setHeaderInput(e.target.value)}
                          className="w-full h-[42px] pl-10 pr-20 text-sm rounded-full bg-background border border-gray-300 hover:border-gray-400 placeholder:text-muted-foreground outline-none focus:border-primary focus:hover:border-primary focus:ring-4 focus:ring-primary/15 transition-[color,box-shadow,border-color] duration-200"
                          placeholder="Ask Birdy about your marketing data..."
                          aria-label="Ask Birdy"
                        />
                        {!headerInput && (
                          <kbd className="absolute top-1/2 -translate-y-1/2 right-11 hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-pd-divider text-[10px] font-medium text-pd-body font-sans pointer-events-none">
                            {isMac ? "⌘" : "Ctrl"}K
                          </kbd>
                        )}
                        <Button
                          type="submit"
                          size="icon-sm"
                          variant={headerInput.trim() ? "default" : "secondary"}
                          disabled={!headerInput.trim()}
                          // Centred with a negative margin rather than a
                          // translate: the Button's own hover lift is a
                          // translate too, and the two would fight.
                          className="absolute top-1/2 right-1.5 -mt-4"
                          aria-label="Ask Birdy"
                        >
                          <Search className="h-4 w-4" />
                        </Button>
                      </form>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Dashboard date range + granularity; renders on that
                          route only, since nothing else obeys them. */}
                      <DashboardHeaderControls />
                      <PageHeaderControls />
                      <NotificationsDropdown />
                      <UserMenu />
                    </div>
                  </header>

                  {/* Content */}
                  <SidebarInset className="flex-1 overflow-hidden bg-pd-canvas">
                    <div className="mx-auto w-full flex flex-1 flex-col gap-4 p-4 md:p-6 overflow-x-hidden overflow-y-auto h-full">
                      {children}
                    </div>
                  </SidebarInset>

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
          </SidebarProvider>
        </ProtectedLayout>
        </SWRProvider>
        </MotionConfig>
        <Toaster />
      </body>
    </html>
  );
}
