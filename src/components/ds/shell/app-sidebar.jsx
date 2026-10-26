"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronsUpDown, LogOut, Search, Settings, Shield, Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"
import { apiRequest } from "@/lib/api"
import { clearSession } from "@/lib/session"
import { openBirdyChat } from "@/lib/ask-birdy"
import { useRole } from "@/hooks/useRole"
import { Tabs, TabsList, TabsTrigger } from "../primitives/tabs"
import { KbdShortcut } from "../primitives/kbd"
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

/**
 * A nav row, verbatim from Bytes `ui/sidebar.tsx`: 32 tall (40 with 16 text in the phone drawer),
 * r10, an 18 line icon and a 14/500 label. The current row rises white with the control shadow and
 * a 600 ink label; its icon is not tinted.
 */
const SIDEBAR_ROW =
  "flex h-10 w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-control-sm pr-2 pl-2.5 text-left text-base font-medium text-ink-secondary outline-none transition-colors md:h-8 md:text-sm hover:bg-rail-frame focus-visible:shadow-focus disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-raised data-[active=true]:font-semibold data-[active=true]:text-foreground data-[active=true]:shadow-control data-[state=open]:bg-rail-frame [&>span:last-child]:truncate [&_svg]:size-[18px] [&_svg]:shrink-0 group-has-data-[slot=sidebar-menu-action]/menu-item:pr-8"

/** A row on the 56 rail: the 40 square around the icon; the label stays for screen readers. */
const RAIL_ROW = "w-10 justify-center px-0 md:h-10"

/** The search row, verbatim from Bytes `sidebar-search-row.tsx`. */
const SEARCH_ROW =
  "flex h-10 w-full shrink-0 cursor-pointer items-center gap-2 rounded-control-sm bg-raised pr-1.5 pl-2.5 text-left text-base text-muted-foreground shadow-control outline-none transition-shadow hover:shadow-control-hover focus-visible:shadow-focus md:h-8 md:text-sm"

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

// The signed-in user's name as stored at login; null until known.
function useStoredUserName() {
  const [name, setName] = React.useState(null)
  React.useEffect(() => {
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
  }, [])
  return name
}

/**
 * Primary navigation: the account switcher, Browse / Ask Birdy tabs, search, the nav list, then
 * background jobs and credits. 256 wide; `collapsed` makes it the 56 icon rail.
 *
 * Renders as a fixed-width column on the canvas; the layout decides when it is visible
 * (hidden below md, shown in MobileNavSheet instead).
 *
 * @param {object} props
 * @param {typeof NAV_ITEMS} [props.items=NAV_ITEMS]
 * @param {string} [props.agencyName] Overrides the name read from the stored user.
 * @param {() => void} [props.onSearch] Called by the search row (and ⌘K handlers wired by the layout).
 * @param {() => void} [props.onNavigate] Called after any link is chosen; the mobile sheet uses it to close.
 * @param {boolean} [props.minimal] Admin console: no Browse/Ask switch, search, credits or jobs.
 * @param {boolean} [props.collapsed=false] The 56 rail: icons only.
 * @param {boolean} [props.animated=false] Animate the width between panel and rail; off until the user toggles, so a restored rail does not slide on load.
 * @param {React.ReactNode} [props.caption] Under the name on the account trigger. Defaults to "Agency workspace", or none when `minimal`.
 * @param {string} [props.headerClassName] On the account trigger's row, e.g. room for a sheet's close button.
 */
function AppSidebar({
  items = NAV_ITEMS,
  agencyName,
  onSearch,
  onNavigate,
  minimal = false,
  collapsed = false,
  animated = false,
  caption,
  headerClassName,
  className,
}) {
  const pathname = usePathname()
  const { isAdmin } = useRole()
  const userName = useStoredUserName()
  const name = agencyName ?? userName ?? "Birdy"
  const triggerCaption = caption === undefined ? (minimal ? null : "Agency workspace") : caption

  const handleMode = (next) => {
    // Ask Birdy opens the chat modal; the tabs stay on Browse.
    if (next !== "ask") return
    openBirdyChat()
    onNavigate?.()
  }

  const handleLogout = async () => {
    const ok = await confirm({
      title: "Are you sure you want to logout?",
      description: "You will be logged out of your account and redirected to the landing page.",
      confirmLabel: "Logout",
    })
    if (ok) await logout()
  }

  const mainItems = items.filter((i) => (i.section ?? "main") === "main")
  const bottomItems = items.filter((i) => i.section === "bottom")

  const renderItem = (item) => {
    const active = isActive(item, pathname)
    const count = item.badge?.() ?? null
    const Icon = item.icon
    return (
      <li key={item.key}>
        <Link
          href={item.href}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          data-active={active}
          title={collapsed ? item.label : undefined}
          className={cn(SIDEBAR_ROW, collapsed && RAIL_ROW)}
        >
          <Icon aria-hidden />
          {collapsed ? (
            <span className="sr-only">{item.label}</span>
          ) : (
            <>
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {count != null && count > 0 && (
                <span className="num shrink-0 rounded-full bg-primary-soft px-1.5 text-xs font-medium text-primary">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </>
          )}
        </Link>
      </li>
    )
  }

  return (
    <aside
      data-ds="app-sidebar"
      data-state={collapsed ? "collapsed" : "expanded"}
      className={cn(
        "flex h-full shrink-0 flex-col gap-3 py-2.5 font-sans text-sidebar-foreground",
        animated && "motion-safe:transition-[width] motion-safe:duration-200 motion-safe:ease-edge",
        collapsed ? "w-14 items-center px-2" : "w-64 px-2.5",
        className
      )}
    >
      <div data-slot="sidebar-header" className={cn("flex shrink-0", !collapsed && "w-full", headerClassName)}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Account menu"
              title={collapsed ? name : undefined}
              className={cn(
                "flex h-12 shrink-0 cursor-pointer items-center rounded-control outline-none transition-colors hover:bg-rail-frame focus-visible:shadow-focus data-[state=open]:bg-rail-frame",
                collapsed ? "w-10 justify-center" : "w-full min-w-0 gap-2.5 px-2"
              )}
            >
              {/* Bytes BrandTile: the 32 r9 tile, the agency's initial on primary. */}
              <span
                data-slot="brand-tile"
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-primary text-sm font-semibold text-primary-foreground"
              >
                {name.charAt(0).toUpperCase()}
              </span>
              {!collapsed && (
                <>
                  {/* Bytes SwitcherLabel: name 16/600 over a 13 muted caption. */}
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-base leading-5 font-semibold text-foreground">{name}</span>
                    {triggerCaption && (
                      <span className="block truncate text-xs leading-4 text-muted-foreground">{triggerCaption}</span>
                    )}
                  </span>
                  <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side={collapsed ? "right" : "bottom"} align="start" sideOffset={6} className="w-56">
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

      {!minimal && !collapsed && (
        <div className="shrink-0">
          <Tabs value="browse" onValueChange={handleMode}>
            <TabsList aria-label="Sidebar mode" surface="frame" size="sm" fill>
              <TabsTrigger value="browse">Browse</TabsTrigger>
              <TabsTrigger value="ask">
                <Sparkles aria-hidden className="size-4 text-primary" />
                Ask Birdy
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}

      {!minimal &&
        (collapsed ? (
          <button
            type="button"
            aria-haspopup="dialog"
            aria-label="Search"
            title="Search"
            onClick={onSearch}
            className={cn(SIDEBAR_ROW, RAIL_ROW)}
          >
            <Search aria-hidden />
          </button>
        ) : (
          <button type="button" aria-haspopup="dialog" onClick={onSearch} className={SEARCH_ROW}>
            <Search className="size-4 shrink-0" aria-hidden />
            <span className="flex-1">Search</span>
            <KbdShortcut keys={["mod", "k"]} />
          </button>
        ))}

      <nav aria-label="Main" className="-m-2 min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-2">
        <ul className="flex w-full min-w-0 flex-col gap-0.5">
          {mainItems.map(renderItem)}
        </ul>
        {bottomItems.length > 0 && (
          <>
            <div data-slot="nav-divider" role="separator" className="my-2 h-px bg-border" />
            <ul className="flex w-full min-w-0 flex-col gap-0.5">{bottomItems.map(renderItem)}</ul>
          </>
        )}
      </nav>

      {!minimal && !collapsed && (
        <div className="flex shrink-0 flex-col gap-2">
          <SidebarJobs />
          <SidebarCredits />
        </div>
      )}
    </aside>
  )
}

export { AppSidebar }
