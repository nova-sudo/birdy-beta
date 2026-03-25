"use client";

import "./globals.css";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import ProtectedLayout from '../components/ProtectedLayout';
import { AppSidebar } from "@/components/app-sidebar";
import { usePathname } from "next/navigation";
import { Bell, UserRound, Search, Bird } from 'lucide-react';
import Script from "next/script";

export default function RootLayout({ children }) {
  const pathname = typeof window !== "undefined" ? usePathname() : null;
  const hideSidebar = pathname === "/login" || pathname === "/register" || pathname === "/";

  return (
    <html suppressHydrationWarning>
      <head>
        <Script src="https://example.com/script.js" strategy="afterInteractive" />
      </head>
      <body suppressHydrationWarning>
        <ProtectedLayout>
          <SidebarProvider open={false}>
            {!hideSidebar && (
              <div className="flex flex-col h-screen w-full">
                {/* Top Header - spans full width including sidebar area */}
                <header className="bg-[#f6f8fa] border-b border-gray-200 w-full z-50 flex items-center justify-between px-4 py-2 h-15 shrink-0">
                  {/* Left: Sidebar trigger + Logo */}
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

                  {/* Center: Search bar */}
                  {/* <div className="hidden sm:flex flex-1 max-w-md mx-6">
                    <div className="relative w-full">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="Ask Birdy about your marketing data..."
                        className="w-full pl-9 pr-4 py-1.5 h-10 bg-white rounded-full bg-gray-100 text-sm text-gray-600 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-200 border border-gray-200"
                      />
                    </div>
                  </div> */}

                  {/* Right: Bell + User */}
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

                {/* Below header: Sidebar + Content side by side */}
                <div className="flex flex-1 overflow-hidden">
                  <AppSidebar />
                  <SidebarInset>
                    <div className="mx-auto bg-[#f6f8fa] w-full flex flex-1 flex-col gap-4 p-4 md:p-6 overflow-x-hidden overflow-y-auto h-full">
                      {children}
                    </div>
                  </SidebarInset>
                </div>
              </div>
            )}

            {/* No sidebar pages (login, register, home) */}
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