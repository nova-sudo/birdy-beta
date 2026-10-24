"use client"

import * as React from "react"
import { Menu, Search, Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"
import { openBirdyChat } from "@/lib/ask-birdy"
import NotificationsDropdown from "@/components/NotificationsDropdown"
import { PageHeaderControls, PageHeaderTitle } from "@/components/page-header"
import { Button } from "../primitives/button"
import { Kbd } from "../primitives/kbd"
import { useModKey } from "./use-mod-key"

/**
 * Global header: menu button (below md), the page's title, Ask Birdy, the
 * notifications bell, and the page's own controls.
 *
 * Pages publish their title and controls through the page-header context; the `title` and `actions` props override those when given.
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
  const modKey = useModKey()
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
        {title ?? <PageHeaderTitle />}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
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
          <Kbd>{modKey}J</Kbd>
        </Button>
        <NotificationsDropdown />
      </div>
    </header>
  )
}

export { TopBar }
