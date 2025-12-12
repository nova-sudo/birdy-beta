"use client";

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import ProtectedLayout from '../components/ProtectedLayout';
import { AppSidebar } from "@/components/app-sidebar";
import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { Bell } from 'lucide-react';
import { UserRound } from 'lucide-react';
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const App = () => {
  return (
    <Bell />,
    <UserRound />
  );
};



export default function RootLayout({ children }) {
  const pathname = typeof window !== "undefined" ? usePathname() : null;
  const hideSidebar = pathname === "/login" || pathname === "/register" || pathname === "/";

  return (
    <html suppressHydrationWarning>
      <head>
        {/* Defer third-party scripts to avoid DOM modifications before hydration */}
        <Script src="https://example.com/script.js" strategy="afterInteractive" />
      </head>
      <body suppressHydrationWarning>
          <ProtectedLayout>

            <SidebarProvider open={false} >
              {!hideSidebar && <AppSidebar />}
              <SidebarInset>
                {!hideSidebar && (
                  <header className=" bg-white w-full z-50 top-0 flex h-12 shrink-0 items-center gap-2 border-b px-4">
                    <Separator orientation="vertical" className=" h-4" />
                    <SidebarTrigger className="md:hidden"/>
                    <div className="flex ml-auto px-4 item-center gap-6">
                      <Bell className="size-4"/>
                      <UserRound className="size-4"/>
                    </div>
                  </header>
                )}
                <div id="do not change the width" className="mx-auto flex mx-auto flex-1 flex-col gap-4 p-4 overflow-x-clip">
                  {children}
                </div>
              </SidebarInset>
            </SidebarProvider>
          </ProtectedLayout>
      </body>
    </html>
  );
}