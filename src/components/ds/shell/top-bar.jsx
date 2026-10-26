"use client"

import * as React from "react"
import { Menu, PanelLeft, Search, Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"
import { openBirdyChat } from "@/lib/ask-birdy"
import NotificationsDropdown from "@/components/NotificationsDropdown"
import { PageHeaderControls, PageHeaderTitle } from "@/components/page-header"
import { Button } from "../primitives/button"
import { KbdShortcut } from "../primitives/kbd"

/**
 * The 52 top bar on the canvas, over the page card only: the sidebar toggle and a hairline (the
 * menu button below md), the page's title, then the page's controls, Ask Birdy and the bell.
 * Borderless and unfilled; the white page card starts below it.
 *
 * Pages publish their title and controls through the page-header context; the `title` and
 * `actions` props override those when given.
 *
 * Fits at 390px: the title truncates, search and Ask Birdy collapse to icon buttons below md.
 *
 * `minimal` is the admin console's bar: the menu button, title and `actions` only, with no
 * sidebar toggle, search, Ask Birdy or bell.
 *
 * @param {object} props
 * @param {React.ReactNode} [props.title] Defaults to the title the current page published.
 * @param {React.ReactNode} [props.actions] Rendered before the bell, in addition to published page controls.
 * @param {() => void} [props.onMenuClick] Opens MobileNavSheet; the menu button shows below md.
 * @param {() => void} [props.onToggleSidebar] Moves the desktop sidebar between panel and rail.
 * @param {() => void} [props.onSearch] Called by the search icon button (below md).
 * @param {boolean} [props.minimal=false] Admin console: no sidebar toggle, search, Ask Birdy or bell.
 */
function TopBar({ title, actions, onMenuClick, onToggleSidebar, onSearch, minimal = false, className }) {
  return (
    <header
      data-ds="top-bar"
      className={cn(
        "flex h-[52px] w-full min-w-0 shrink-0 items-center gap-2 px-1.5 font-sans md:pr-2.5",
        className
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="text-ink-secondary md:hidden"
        aria-label="Open navigation"
        onClick={onMenuClick}
      >
        <Menu />
      </Button>
      {!minimal && (
        <>
          <Button
            variant="ghost"
            size="icon-sm"
            className="hidden text-ink-secondary md:inline-flex"
            aria-label="Toggle sidebar"
            onClick={onToggleSidebar}
          >
            <PanelLeft />
          </Button>
          <span aria-hidden className="hidden h-4 w-px shrink-0 bg-hairline md:block" />
        </>
      )}

      <div className="min-w-0 flex-1 truncate text-base font-semibold">
        {title ?? <PageHeaderTitle />}
      </div>

      <div className="flex shrink-0 items-center gap-1 md:gap-2">
        <PageHeaderControls />
        {actions}
        {!minimal && (
          <>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Search" onClick={onSearch}>
              <Search />
            </Button>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Ask Birdy" onClick={openBirdyChat}>
              <Sparkles className="text-primary" />
            </Button>
            <Button variant="outline" size="sm" className="hidden pr-1.5 md:inline-flex" onClick={openBirdyChat}>
              <Sparkles className="text-primary" />
              Ask Birdy
              <KbdShortcut keys={["mod", "j"]} />
            </Button>
            <NotificationsDropdown />
          </>
        )}
      </div>
    </header>
  )
}

export { TopBar }
