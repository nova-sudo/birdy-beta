"use client";
import { useState } from "react"
import "./globals.css";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import ProtectedLayout from '../components/ProtectedLayout';
import { AppSidebar } from "@/components/app-sidebar";
import { usePathname } from "next/navigation";
import { Bell, UserRound, Search, Bird } from 'lucide-react';
import Script from "next/script";
import {Settings, LogOut } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export default function RootLayout({ children }) {
  const [open, setOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)  
  const pathname = typeof window !== "undefined" ? usePathname() : null;
  const hideSidebar = pathname === "/login" || pathname === "/register" || pathname === "/";

  const handleLogout = async () => {
    setIsLoggingOut(true)

    try {
      // Call logout API
      const response = await fetch('https://birdy-backend.vercel.app/api/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        // Clear all localStorage
        localStorage.clear()

        // Clear all sessionStorage
        sessionStorage.clear()

        // Redirect to landing page
        window.location.href = '/'
      } else {
        console.error('Logout failed:', await response.text())
        // Still redirect even if API fails
        localStorage.clear()
        sessionStorage.clear()
        window.location.href = '/'
      }
    } catch (error) {
      console.error('Logout error:', error)
      // Still redirect even if there's an error
      localStorage.clear()
      sessionStorage.clear()
      window.location.href = '/'
    } finally {
      setIsLoggingOut(false)
    }
  }

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
                <header className="bg-[#f6f8fa] border-b border-gray-200 w-full z-50 flex items-center justify-between px-2 py-2 h-15 shrink-0">
                  {/* Left: Sidebar trigger + Logo */}
                  <div className="flex items-center gap-0">
                    <SidebarTrigger className="md:hidden"/>
                    <div className="flex items-center gap-1.5">
                      <div className="bg-sidebar-primary text-sidebar-primary-foreground rounded-md flex aspect-square
                       size-8 items-center justify-center">
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
                    <a href="/alerts">
                      <button className="relative p-1.5 h-9 w-9 rounded-full hover:bg-gray-100 transition">
                        <Bell className="w-5 h-5 text-black font-medium text-sm" />
                      </button>
                    </a>
                    <div className="relative">
                      {/* Overlay to close dropdown */}
                      {open && (
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setOpen(false)}
                        />
                      )}

                      {/* Trigger button */}
                      <button
                        onClick={() => setOpen((prev) => !prev)}
                        className="p-1.5 h-9 w-9 rounded-full hover:bg-gray-100 transition flex items-center justify-center relative z-50"
                      >
                        <UserRound className="w-5 h-5 text-black" />
                      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
          <p className="px-4 py-2 text-sm font-semibold text-gray-900">My Account</p>
          <hr className="my-1 border-gray-100" />

          <a href="/settings?tab=account">
           <button
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
           >
              <UserRound className="w-4 h-4" />
              Profile
            </button>
          </a>
         
          <a href="/settings">
            <button
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
          </a>
          <hr className="my-1 border-gray-100" />

          <button
            onClick={() => setShowLogoutDialog(true)}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
          >
            <LogOut className="w-4 h-4 text-red-600" />
            Log out
          </button>
        </div>
      )}
    </div>
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

        <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog} >
        <AlertDialogContent className="bg-white ">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to logout?</AlertDialogTitle>
            <AlertDialogDescription>
              You will be logged out of your account and redirected to the landing page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoggingOut}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isLoggingOut ? "Logging out..." : "Logout"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </body>
    </html>
  );
}