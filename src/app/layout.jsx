"use client";

import "./globals.css";
import { fontVariables } from "@/lib/pd-fonts";
import { poppins } from "@/lib/by-fonts";
import { MotionConfig } from "framer-motion";
import ProtectedLayout from '../components/ProtectedLayout';
import SWRProvider from "@/components/swr-provider";
import { AppShell } from "@/components/shell/app-shell";
import { isRebuilt } from "@/components/shell/nav";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
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
import { Toaster } from "@/components/ui/sonner";
import { ConfirmHost } from "@/components/ds";
import { AgentRunBanner } from "@/components/agents/AgentRunBanner";
import { CreditsProvider } from "@/hooks/useCredits";
import { DashboardControlsProvider } from "@/components/dashboard-controls";
import { PageHeaderProvider } from "@/components/page-header";

export default function RootLayout({ children }) {
  const pathname = usePathname();
  // /admin runs as a separate app-shell (its own dark rail + topbar via
  // src/app/admin/layout.jsx), so it opts out of the main shell here.
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
    // The OAuth consent screen is a standalone card; an AI app sent the owner here.
    pathname.startsWith("/connect") ||
    // The redesign's component preview brings its own shell.
    pathname.startsWith("/kit") ||
    pathname.startsWith("/admin");

  const [chatOpen, setChatOpen] = useState(false);
  const [chatInitialMsg, setChatInitialMsg] = useState("");

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

  return (
    <html suppressHydrationWarning className={`${fontVariables} ${poppins.variable}`}>
      <head />
      <body suppressHydrationWarning className="antialiased">
        <BirdyDefs />
        <MotionConfig reducedMotion="user">
        <SWRProvider>
        <ProtectedLayout>
            {!hideSidebar && (
              <CreditsProvider>
              {/* Pages not yet rebuilt still publish a title and controls to
                  these two providers. The redesign's shell has no top bar to
                  show them in, so the providers stay mounted (the pages' hooks
                  need them) and nothing renders what they hold. */}
              <DashboardControlsProvider>
              <PageHeaderProvider>
              <AppShell>
                {/* Impersonation banner (shows only while an admin is impersonating) */}
                <ImpersonationBar />
                {/* An agent that couldn't run because Meta needs reconnecting */}
                <AgentRunBanner />

                {/* Content */}
                {isRebuilt(pathname) ? (
                  <main className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">{children}</main>
                ) : (
                  <main className="relative flex w-full flex-1 flex-col overflow-hidden bg-pd-canvas">
                    <div className="mx-auto w-full flex flex-1 flex-col gap-4 p-4 md:p-6 overflow-x-hidden overflow-y-auto h-full">
                      {children}
                    </div>
                  </main>
                )}

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
              </AppShell>
              </PageHeaderProvider>
              </DashboardControlsProvider>
              </CreditsProvider>
            )}

            {hideSidebar && (
              <div className="w-full">
                {children}
              </div>
            )}
        </ProtectedLayout>
        </SWRProvider>
        </MotionConfig>
        <Toaster />
        <ConfirmHost />
      </body>
    </html>
  );
}
