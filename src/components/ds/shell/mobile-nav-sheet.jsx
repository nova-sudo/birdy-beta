"use client"

import * as React from "react"

import { Sheet, SheetContent, SheetDescription, SheetTitle } from "../overlays/sheet"
import { AppSidebar } from "./app-sidebar"

/**
 * Below 768px the sidebar lives in a left sheet, opened by the TopBar menu
 * button. Choosing a destination closes it.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {object} [props.sidebarProps] Forwarded to AppSidebar (items, agencyName, onSearch)
 */
function MobileNavSheet({ open, onOpenChange, sidebarProps }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[300px] gap-0 rounded-r-[24px] bg-frame p-0 sm:max-w-[300px]">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SheetDescription className="sr-only">Primary navigation</SheetDescription>
        <div data-ds="mobile-nav-sheet" className="min-h-0 flex-1">
          <AppSidebar {...sidebarProps} onNavigate={() => onOpenChange(false)} className="w-full" />
        </div>
      </SheetContent>
    </Sheet>
  )
}

export { MobileNavSheet }
