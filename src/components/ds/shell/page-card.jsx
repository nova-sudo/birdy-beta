import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * The white page card under the top bar: an 8px canvas gutter right and bottom on desktop, a
 * sheet-like card rounded on top on a phone. `main` scrolls inside it and holds the page in the
 * 1360 column. The side gutters are 24px until the window is 1280 wide, then 40: a 40px gutter
 * on a narrow window (sidebar collapsed, or a small laptop) wastes width the tables need.
 *
 * A page whose root is marked `data-main-fill` (its own panes scroll inside it) is held to main's
 * height instead of growing with its content; `data-main-bleed` does the same and also drops the
 * gutters and the 1360 cap, so the page takes the whole card.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children
 */
function PageCard({ className, children }) {
  return (
    <div
      data-ds="page-card"
      data-slot="page-surface"
      className={cn(
        "relative mx-1.5 flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-[24px] bg-background shadow-surface md:mx-0 md:mr-2 md:mb-2 md:rounded-frame",
        className
      )}
    >
      <main className="flex min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[1360px] flex-1 flex-col gap-4 px-4 pt-6 pb-[calc(2.5rem+env(safe-area-inset-bottom))] md:px-6 md:pt-9 xl:px-10 md:pb-10 has-[[data-main-fill]]:min-h-0 has-[[data-main-bleed]]:min-h-0 has-[[data-main-bleed]]:max-w-none has-[[data-main-bleed]]:p-0">
          {children}
        </div>
      </main>
    </div>
  )
}

export { PageCard }
