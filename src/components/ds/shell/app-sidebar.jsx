"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronsUpDown, LogOut, Search, Settings, Shield } from "lucide-react"

import { cn } from "@/lib/utils"
import { apiRequest } from "@/lib/api"
import { clearSession } from "@/lib/session"
import { openBirdyChat } from "@/lib/ask-birdy"
import { useRole } from "@/hooks/useRole"
import BirdyAvatar from "@/components/birdy/BirdyAvatar"
import { useBirdy } from "@/components/birdy/use-birdy"
import { SegmentedTabs } from "../primitives/segmented-tabs"
import { Kbd } from "../primitives/kbd"
import { confirm } from "../overlays/confirm"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../overlays/dropdown-menu"
import { NAV_ITEMS, isActive } from "./nav-config"
import { SidebarCredits } from "./sidebar-credits"
import { SidebarJobs } from "./sidebar-jobs"

const MODES = [
  { value: "browse", label: "Browse" },
  { value: "ask", label: "Ask Birdy" },
]

// Best-effort API call, then clear local state and return to the landing page.
async function logout() {
  try {
    await apiRequest("/api/logout", { method: "POST" })
  } catch {
    // Log out even if the API call fails.
  } finally {
    localStorage.clear()
    sessionStorage.clear()
    // localStorage.clear() leaves cookies alone; a session hint left behind
    // would route the next visitor as though they were still signed in.
    clearSession()
    window.location.href = "/"
  }
}

// The signed-in user's agency name, as stored at login; "Birdy" until known.
function useAgencyName(override) {
  const [name, setName] = React.useState(null)
  React.useEffect(() => {
    if (override) return
    const read = () => {
      try {
        setName(JSON.parse(localStorage.getItem("user") || "null")?.name ?? null)
      } catch {
        setName(null)
      }
    }
    read()
    window.addEventListener("userUpdated", read)
    return () => window.removeEventListener("userUpdated", read)
  }, [override])
  return override ?? name ?? "Birdy"
}

/**
 * Primary navigation rail: agency header, Browse / Ask Birdy switch, search,
 * the nav list, then credits, background jobs and the user menu.
 *
 * Renders as a fixed-width column; the layout decides when it is visible
 * (hidden below md, shown in MobileNavSheet instead).
 *
 * @param {object} props
 * @param {typeof NAV_ITEMS} [props.items=NAV_ITEMS]
 * @param {string} [props.agencyName] Overrides the name read from the stored user.
 * @param {() => void} [props.onSearch] Called by the search button (and ⌘K handlers wired by the layout).
 * @param {() => void} [props.onNavigate] Called after any link is chosen; the mobile sheet uses it to close.
 */
function AppSidebar({ items = NAV_ITEMS, agencyName, onSearch, onNavigate, className }) {
  const pathname = usePathname()
  const { state: birdyState } = useBirdy()
  const { isAdmin } = useRole()
  const name = useAgencyName(agencyName)
  const [mode, setMode] = React.useState("browse")

  const handleMode = (next) => {
    if (next === "ask") {
      // Ask Birdy opens the chat modal; the rail stays on Browse.
      openBirdyChat()
      onNavigate?.()
      return
    }
    setMode(next)
  }

  const handleLogout = async () => {
    const ok = await confirm({
      title: "Are you sure you want to logout?",
      description: "You will be logged out of your account and redirected to the landing page.",
      confirmLabel: "Logout",
    })
    if (ok) await logout()
  }

  return (
    <aside
      data-ds="app-sidebar"
      className={cn(
        "flex h-full w-60 shrink-0 flex-col gap-4 border-r border-border bg-background p-3 font-sans text-foreground",
        className
      )}
    >
      <Link
        href="/clients"
        onClick={onNavigate}
        className="flex min-w-0 items-center gap-2.5 rounded-control p-1 outline-none focus-visible:shadow-control-focus"
      >
        <BirdyAvatar state={birdyState} size={32} />
        <span className="min-w-0 flex-1 truncate text-base font-semibold">{name}</span>
      </Link>

      <SegmentedTabs
        ariaLabel="Sidebar mode"
        value={mode}
        onValueChange={handleMode}
        items={MODES}
        className="w-full [&>button]:flex-1"
      />

      <button
        type="button"
        onClick={onSearch}
        className="flex h-control items-center gap-2 rounded-control bg-background px-3 text-sm text-muted-foreground shadow-control outline-none transition-colors hover:bg-muted focus-visible:shadow-control-focus"
      >
        <Search className="size-4 shrink-0" />
        <span className="flex-1 text-left">Search</span>
        <Kbd>⌘K</Kbd>
      </button>

      <nav aria-label="Main" className="-mx-1 flex-1 overflow-y-auto px-1">
        <ul className="flex flex-col gap-0.5">
          {items.map((item) => {
            const active = isActive(item, pathname)
            const count = item.badge?.() ?? null
            const Icon = item.icon
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-control items-center gap-2.5 rounded-control px-3 text-sm font-medium outline-none transition-colors focus-visible:shadow-control-focus",
                    active
                      ? "bg-background text-foreground shadow-control"
                      : "text-body hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {count != null && count > 0 && (
                    <span className="num rounded-full bg-primary-soft px-1.5 text-xs font-medium text-primary">
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="flex flex-col gap-2">
        <SidebarJobs />
        <SidebarCredits />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Account menu"
              className="flex h-control items-center gap-2 rounded-control px-3 text-sm font-medium outline-none transition-colors hover:bg-muted focus-visible:shadow-control-focus"
            >
              <span className="min-w-0 flex-1 truncate text-left">Account</span>
              <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-52">
            {isAdmin && (
              <DropdownMenuItem asChild>
                <Link href="/admin" onClick={onNavigate}>
                  <Shield /> Admin console
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link href="/settings" onClick={onNavigate}>
                <Settings /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={handleLogout}>
              <LogOut /> Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}

export { AppSidebar }
