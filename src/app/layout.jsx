"use client";

import "./globals.css";
import { Outfit } from "next/font/google";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import UserMenu from "@/components/UserMenu";
import ProtectedLayout from '../components/ProtectedLayout';
import { AppSidebar } from "@/components/app-sidebar";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { Search, Sparkles, Tag } from 'lucide-react';
import { APP_VERSION } from "@/lib/changelog";
import { ASK_BIRDY_EVENT } from "@/lib/ask-birdy";
import BirdyChatModal from "@/components/chat/BirdyChatModal";
import NotificationsDropdown from "@/components/NotificationsDropdown";
import ImpersonationBar from "@/components/ImpersonationBar";
import { Toaster } from "@/components/ui/sonner";
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

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

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
      <span className="text-lg font-bold leading-none text-foreground">Birdy</span>
      <Link
        href="/changelog"
        aria-label={`What's new in Birdy — version ${APP_VERSION}`}
        title={`What's new — ${APP_VERSION}`}
        className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
      >
        <Badge
          variant="secondary"
          className="cursor-pointer gap-1 font-semibold transition-colors hover:bg-secondary/70"
        >
          <Tag className="h-3 w-3 text-purple-500" aria-hidden="true" />
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
  const hideSidebar =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/" ||
    pathname === "/onboarding" ||
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
      if (!msg) return;
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
    <html suppressHydrationWarning>
      <head />
      <body suppressHydrationWarning className={`${outfit.className} antialiased`}>
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
                  {/* Top Header */}
                  <header className="bg-background border-b border-gray-200 w-full z-50 flex items-center justify-between px-4 py-2 h-15 shrink-0">
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
                        <Sparkles className="absolute top-1/2 -translate-y-1/2 left-3.5 h-4 w-4 text-purple-500 pointer-events-none" />
                        <input
                          ref={headerInputRef}
                          value={headerInput}
                          onChange={(e) => setHeaderInput(e.target.value)}
                          className="w-full h-[42px] pl-10 pr-20 text-sm rounded-full bg-white border border-input placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition"
                          placeholder="Ask Birdy about your marketing data..."
                          aria-label="Ask Birdy"
                        />
                        {!headerInput && (
                          <kbd className="absolute top-1/2 -translate-y-1/2 right-11 hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border/60 bg-muted/40 text-[10px] font-medium text-muted-foreground font-sans pointer-events-none">
                            {isMac ? "⌘" : "Ctrl"}K
                          </kbd>
                        )}
                        <button
                          type="submit"
                          disabled={!headerInput.trim()}
                          className={`absolute top-1/2 -translate-y-1/2 right-1.5 h-8 w-8 flex items-center justify-center rounded-full transition ${
                            headerInput.trim()
                              ? "bg-purple-600 text-white hover:bg-purple-700"
                              : "bg-muted/60 text-muted-foreground"
                          }`}
                          aria-label="Ask Birdy"
                        >
                          <Search className="h-4 w-4" />
                        </button>
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

                  {/* Birdy Chat Modal */}
                  <BirdyChatModal
                    open={chatOpen}
                    onOpenChange={(v) => {
                      setChatOpen(v);
                      if (!v) setChatInitialMsg("");
                    }}
                    initialMessage={chatInitialMsg}
                    pathname={pathname}
                  />
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
        <Toaster />
      </body>
    </html>
  );
}
