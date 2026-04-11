"use client";

import "./globals.css";
import { Outfit } from "next/font/google";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import ProtectedLayout from '../components/ProtectedLayout';
import { AppSidebar } from "@/components/app-sidebar";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Bell, UserRound, Bird, Search } from 'lucide-react';
import BirdyChatModal from "@/components/chat/BirdyChatModal";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export default function RootLayout({ children }) {
  const pathname = usePathname();
  const hideSidebar = pathname === "/login" || pathname === "/register" || pathname === "/";

  const [chatOpen, setChatOpen] = useState(false);
  const [chatInitialMsg, setChatInitialMsg] = useState("");
  const [headerInput, setHeaderInput] = useState("");
  const [bytesDesign, setBytesDesign] = useState(false);

  // Feature flag: bytes-design
  useEffect(() => {
    const stored = localStorage.getItem("birdy_bytes_design");
    if (stored === "true") setBytesDesign(true);
  }, []);

  useEffect(() => {
    if (bytesDesign) {
      document.body.classList.add("bytes-design");
    } else {
      document.body.classList.remove("bytes-design");
    }
  }, [bytesDesign]);

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
              <div className="flex flex-col h-screen w-full">
                {/* Top Header */}
                <header className="bg-background border-b border-gray-200 w-full z-50 flex items-center justify-between px-4 py-2 h-15 shrink-0">
                  <div className="flex items-center gap-2">
                    <SidebarTrigger className="md:hidden"/>
                    <div className="flex items-center gap-1.5">
                      <div className="bg-sidebar-primary text-sidebar-primary-foreground rounded-md flex aspect-square size-8 items-center justify-center">
                        <Bird className="size-6" />
                      </div>
                      <span className="font-bold text-[#713CDD] text-lg tracking-tight">Birdy</span>
                      <span className="text-xs bg-accent px-2 py-0.5 rounded-md font-semibold">Beta 1.0</span>
                    </div>
                  </div>

                  {/* Center search bar */}
                  <div className="mx-auto flex-1 flex justify-center max-w-2xl px-4">
                    <form onSubmit={handleHeaderSubmit} className="relative w-full max-w-md">
                      <input
                        value={headerInput}
                        onChange={(e) => setHeaderInput(e.target.value)}
                        className="w-full h-[42px] pl-4 pr-10 text-sm rounded-full bg-white border border-input placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                        placeholder="Ask Birdy about your marketing data..."
                      />
                      <button
                        type="submit"
                        disabled={!headerInput.trim()}
                        className="absolute top-1/2 -translate-y-1/2 right-2 h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent transition disabled:opacity-40"
                      >
                        <Search className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </form>
                  </div>

                  <div className="flex items-center gap-3">
                    <button className="relative p-1.5 rounded-full hover:bg-gray-100 transition">
                      <Bell className="w-5 h-5 text-black" />
                      <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                    </button>
                    <button className="p-1.5 rounded-full hover:bg-gray-100 transition">
                      <UserRound className="w-5 h-5 text-black" />
                    </button>
                  </div>
                </header>

                {/* Sidebar + Content */}
                <div className="flex flex-1 overflow-hidden">
                  <AppSidebar />
                  <SidebarInset>
                    <div className="mx-auto bg-background w-full flex flex-1 flex-col gap-4 p-4 md:p-6 overflow-x-hidden overflow-y-auto h-full">
                      {children}
                    </div>
                  </SidebarInset>
                </div>

                {/* Birdy Chat Modal */}
                <BirdyChatModal
                  open={chatOpen}
                  onOpenChange={(v) => {
                    setChatOpen(v);
                    if (!v) setChatInitialMsg("");
                  }}
                  initialMessage={chatInitialMsg}
                />
              </div>
            )}

            {hideSidebar && (
              <div className="w-full">
                {children}
              </div>
            )}
          </SidebarProvider>
        </ProtectedLayout>
      </body>
    </html>
  );
}
