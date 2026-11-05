import {
  House,
  SquareUserRound,
  Calculator,
  List,
  Phone,
  ChartNoAxesColumnIncreasing,
  Bell,
  LayoutGrid,
  Settings,
} from "lucide-react"

import { useAgentWorkCount } from "@/lib/agents-api"

/**
 * Sidebar destinations, in display order. A plain array so a new entry is one line.
 * `section` defaults to "main"; "bottom" items render after a divider below the list.
 *
 * @type {{
 *   key: string,
 *   label: string,
 *   href: string,
 *   icon: React.ComponentType<{ className?: string }>,
 *   section?: "main" | "bottom",
 *   badge?: () => number | null,
 *   match?: (pathname: string) => boolean,
 * }[]}
 */
export const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: House },
  { key: "clients", label: "Clients", href: "/clients", icon: SquareUserRound },
  { key: "metrics", label: "Metrics", href: "/metrics", icon: Calculator },
  { key: "contacts", label: "Contacts", href: "/contacts", icon: List },
  { key: "sales-hub", label: "Sales Hub", href: "/Sales-Hub", icon: Phone },
  { key: "campaigns", label: "Campaigns", href: "/campaigns", icon: ChartNoAxesColumnIncreasing },
  { key: "alerts", label: "Alerts", href: "/alerts", icon: Bell },
  { key: "settings", label: "Settings", href: "/settings", icon: Settings },
  // Agents and dashboards live together. The badge counts open agent work items (hidden at 0 or with no live agent).
  { key: "hub", label: "BirdyHub", href: "/hub", icon: LayoutGrid, section: "bottom", badge: () => useAgentWorkCount() },
]

/** Whether `item` is the current page: its own `match`, else the href or any path under it. */
export function isActive(item, pathname) {
  if (item.match) return item.match(pathname)
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}
