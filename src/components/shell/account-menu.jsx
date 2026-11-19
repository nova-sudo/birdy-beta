"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { MenuItem, MenuSeparator, RailAccount } from "@/components/by";
import { confirm } from "@/components/ds";
import { useRole } from "@/hooks/useRole";
import { apiRequest } from "@/lib/api";
import { clearSession } from "@/lib/session";

/** The signed-in user's name and email, read from the stored user record. */
function useStoredUser() {
  const [user, setUser] = useState({ name: "", email: "" });
  useEffect(() => {
    const read = () => {
      try {
        const stored = JSON.parse(localStorage.getItem("user") || "{}");
        setUser({ name: stored.name || "", email: stored.email || "" });
      } catch {
        setUser({ name: "", email: "" });
      }
    };
    read();
    window.addEventListener("userUpdated", read);
    return () => window.removeEventListener("userUpdated", read);
  }, []);
  return user;
}

/** The avatar at the bottom of the rail and its menu: admin console, settings, log out. */
export function AccountMenu() {
  const router = useRouter();
  const { isAdmin } = useRole();
  const { name, email } = useStoredUser();

  // Best-effort API call, then clear local state and return to the landing page.
  const logOut = async () => {
    const sure = await confirm({ title: "Log out of Birdy?", description: "You’ll need to sign in again to come back.", confirmLabel: "Log out" });
    if (!sure) return;
    try {
      await apiRequest("/api/logout", { method: "POST" });
    } catch {
      // Log out even if the request fails.
    } finally {
      localStorage.clear();
      sessionStorage.clear();
      // Clearing storage leaves cookies alone, and a leftover session hint
      // would route the next visitor as though they were still signed in.
      clearSession();
      window.location.href = "/";
    }
  };

  return (
    <RailAccount name={name || email || "Account"} detail={name ? email : undefined}>
      <MenuSeparator />
      {isAdmin && (
        <MenuItem onSelect={() => router.push("/admin")}><ShieldCheck aria-hidden="true" />Admin console</MenuItem>
      )}
      <MenuItem onSelect={() => router.push("/settings")}><SlidersHorizontal aria-hidden="true" />Settings</MenuItem>
      <MenuSeparator />
      <MenuItem className="text-by-danger" onSelect={logOut}><LogOut aria-hidden="true" />Log out</MenuItem>
    </RailAccount>
  );
}
