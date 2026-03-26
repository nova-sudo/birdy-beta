"use client";

import "./globals.css";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import ProtectedLayout from '../components/ProtectedLayout';
import { AppSidebar } from "@/components/app-sidebar";
import { usePathname } from "next/navigation";
import { Bell, UserRound, Bird } from 'lucide-react';

export default function RootLayout({ children }) {
  const pathname = usePathname();
  const hideSidebar = pathname === "/login" || pathname === "/register" || pathname === "/";

  return (
    <html suppressHydrationWarning>
      <head />
      <body suppressHydrationWarning>
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
