import {
  House,
  SquareUserRound,
  Calculator,
  List,
  Phone,
  ChartNoAxesColumnIncreasing,
  Bell,
  LayoutDashboard,
  Settings,
} from "lucide-react"

/**
 * Sidebar destinations, in display order. A plain array so a new entry
 * (BirdyHub) is one line.
 *
 * @type {{
 *   key: string,
 *   label: string,
 *   href: string,
 *   icon: React.ComponentType<{ className?: string }>,
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
  { key: "dashboards", label: "Dashboards", href: "/dashboards", icon: LayoutDashboard },
  { key: "settings", label: "Settings", href: "/settings", icon: Settings },
]

/** Whether `item` is the current page: its own `match`, else the href or any path under it. */
export function isActive(item, pathname) {
  if (item.match) return item.match(pathname)
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}
