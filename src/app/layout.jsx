"use client";


import "./globals.css";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import ProtectedLayout from '../components/ProtectedLayout';
import { AppSidebar } from "@/components/app-sidebar";
import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { Bell } from 'lucide-react';
import { UserRound } from 'lucide-react';
import Script from "next/script";



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
                  <header className=" bg-[#f6f8fa] md:hidden w-full z-50 top-0 flex mx-auto my-auto">
                    <Separator orientation="vertical" className=" h-4" />
                    <SidebarTrigger className="md:hidden"/>
                  </header>
                )}
                <div id="do not change the width" className=" mx-auto bg-[#f6f8fa] w-full flex flex-1 flex-col gap-4 p-4 md:p-4 overflow-x-hidden">
                  {children}
                </div>
              </SidebarInset>
            </SidebarProvider>
          </ProtectedLayout>
      </body>
    </html>
  );
}