"use client";

// Profile avatar dropdown in the main app header. This is the sole entry point
// to the internal Admin console (admin-gated) now that the sidebar link is gone.

import { useState } from "react";
import Link from "next/link";
import { UserRound, Shield, Settings, LogOut } from "lucide-react";
import { useRole } from "@/hooks/useRole";
import { apiRequest } from "@/lib/api";
import { clearSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function UserMenu() {
  const { isAdmin } = useRole();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Same logout flow as the sidebar footer: best-effort API call, then clear
  // local state and return to the landing page.
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await apiRequest("/api/logout", { method: "POST" });
    } catch {
      // Log out even if the API call fails.
    } finally {
      localStorage.clear();
      sessionStorage.clear();
      // localStorage.clear() doesn't touch cookies, and a session hint left
      // behind would have middleware routing the next visitor as though they
      // were still signed in.
      clearSession();
      setIsLoggingOut(false);
      window.location.href = "/";
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon-lg" className="size-10" aria-label="Account menu">
            <UserRound className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 bg-white">
          <DropdownMenuLabel>Account</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {isAdmin && (
            <DropdownMenuItem asChild className="rounded-xl">
              <Link href="/admin" className="cursor-pointer">
                <Shield className="mr-2 h-4 w-4" />
                Admin console
              </Link>
            </DropdownMenuItem>
          )}

          <DropdownMenuItem asChild className="rounded-xl">
            <Link href="/settings" className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setShowLogoutDialog(true);
            }}
            className="cursor-pointer rounded-xl text-pd-danger focus:bg-pd-danger-bg focus:text-pd-danger"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent className="bg-white">
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
              variant="destructive"
            >
              {isLoggingOut ? "Logging out..." : "Logout"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
