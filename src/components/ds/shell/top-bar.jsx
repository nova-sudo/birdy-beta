"use client"

import * as React from "react"
import { Menu, Search, Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"
import { openBirdyChat } from "@/lib/ask-birdy"
import { PageHeaderControls, PageHeaderTitle } from "@/components/page-header"
import { Button } from "../primitives/button"
import { Kbd } from "../primitives/kbd"

// Loaded on first render rather than at import. NotificationsDropdown pulls in
// lib/alert-helpers.js (a .js file containing JSX) and dashboard-controls pulls
// in next/font; vitest can load neither, and a static import here would break
// every test that imports the ds index.
const NotificationsDropdown = React.lazy(() => import("@/components/NotificationsDropdown"))
const DashboardHeaderTitle = React.lazy(() =>
  import("@/components/dashboard-controls").then((m) => ({ default: m.DashboardHeaderTitle }))
)
const DashboardHeaderControls = React.lazy(() =>
  import("@/components/dashboard-controls").then((m) => ({ default: m.DashboardHeaderControls }))
)

/**
 * Global header: menu button (below md), the page's title, Ask Birdy, the
 * notifications bell, and the page's own controls.
 *
 * Pages publish their title and controls through PageHeader / dashboard-controls
 * context; the `title` and `actions` props override those when given.
 *
 * Fits at 390px: the title truncates, the search pill collapses to an icon
 * button and Ask Birdy to an icon below md.
 *
 * @param {object} props
 * @param {React.ReactNode} [props.title] Breadcrumb; defaults to the title the current page published.
 * @param {React.ReactNode} [props.actions] Rendered before the bell, in addition to published page controls.
 * @param {() => void} [props.onMenuClick] Opens MobileNavSheet; the menu button shows below md.
 * @param {() => void} [props.onSearch] Called by the search icon button (below md).
 */
function TopBar({ title, actions, onMenuClick, onSearch, className }) {
  return (
    <header
      data-ds="top-bar"
      className={cn(
        "flex h-14 w-full min-w-0 shrink-0 items-center gap-2 border-b border-border bg-background px-3 font-sans md:px-6",
        className
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Open navigation"
        onClick={onMenuClick}
      >
        <Menu />
      </Button>

      <div className="min-w-0 flex-1 truncate text-base font-semibold">
        {title ?? (
          <React.Suspense fallback={null}>
            <DashboardHeaderTitle />
            <PageHeaderTitle />
          </React.Suspense>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <React.Suspense fallback={null}>
          <DashboardHeaderControls />
        </React.Suspense>
        <PageHeaderControls />
        {actions}
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Search" onClick={onSearch}>
          <Search />
        </Button>
        <Button variant="outline" size="icon" className="md:hidden" aria-label="Ask Birdy" onClick={openBirdyChat}>
          <Sparkles className="text-primary" />
        </Button>
        <Button variant="outline" className="hidden md:inline-flex" onClick={openBirdyChat}>
          <Sparkles className="text-primary" />
          Ask Birdy
          <Kbd>⌘J</Kbd>
        </Button>
        <React.Suspense fallback={<span className="size-control" aria-hidden />}>
          <NotificationsDropdown />
        </React.Suspense>
      </div>
    </header>
  )
}

export { TopBar }
