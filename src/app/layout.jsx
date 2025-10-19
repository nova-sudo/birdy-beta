"use client";

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { usePathname } from "next/navigation";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});


export default function RootLayout({ children }) {
  const pathname = usePathname();
  const hideSidebar = pathname === "/login" || pathname === "/register" || pathname === "/";

  return (
    <html>
      <body>
        <SidebarProvider>
          {!hideSidebar && <AppSidebar />}
          <main className="w-full min-h-dvh">
            {!hideSidebar && (
              <SidebarTrigger
                className="absolute z-10 bg-gray-900/10 mt-2 shadow rounded-tl-2xl rounded-br-2xl rounded-bl-none rounded-tr-none"
                // Adds full radius to top-left and bottom-left corners
              />
            )}
            <div className={`bg-zinc-50 mt-2 rounded-tl-2xl drop-shadow-sm drop-shadow-purple-200 ${geistSans.variable} ${geistMono.variable}`}>
              {children}
            </div>
          </main>
        </SidebarProvider>
      </body>
    </html>
  );
}
