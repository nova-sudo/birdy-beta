"use client";

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
        <SidebarProvider>
          {!hideSidebar && <AppSidebar />}
          <SidebarInset>
            {!hideSidebar && (
              <header className="bg-background sticky top-0 flex h-16 shrink-0 items-center gap-2 border-b px-4">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-2 h-4" />
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem className="hidden md:block">
                      <BreadcrumbLink href="#">
Birdy Ai                       </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
                      <BreadcrumbPage>Page</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </header>
            )}
            <div className="flex flex-1 flex-col gap-4 p-4">
              {children}
            </div>
          </SidebarInset>
        </SidebarProvider>
      </body>
    </html>
  );
}