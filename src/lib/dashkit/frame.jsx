"use client"
import { PdCard } from "@/components/portfolio/PdCard"

/**
 * dashkit's Frame slot: the card chrome around one widget, built on PdCard so
 * dashboards look like the rest of the product. Mirrors dashkit's own
 * WidgetFrame contract: while `loading` the children stay put under a pulse
 * overlay (so stale numbers don't flash away), `empty` and `error` replace
 * them. `menu` is the editor's handles and goes in the header's right slot.
 *
 * It fills its grid cell (h-full) and the body flexes to the remaining
 * height with min-h-0, so charts sized to 100% have something to measure.
 *
 * @param {string} [title]
 * @param {React.ReactNode} [menu]
 * @param {"ready"|"loading"|"empty"|"error"} state
 * @param {string} [error]
 */
export function PdFrame({ title, menu, state, error, children }) {
  let body
  if (state === "error") {
    body = (
      <div className="text-sm text-pd-danger" role="status">
        {error ?? "Something went wrong"}
      </div>
    )
  } else if (state === "empty") {
    body = <div className="text-sm text-pd-faint">No data bound</div>
  } else {
    body = (
      <>
        {children}
        {state === "loading" && <div className="dk-pulse" aria-hidden="true" />}
      </>
    )
  }

  return (
    <PdCard
      title={title}
      action={menu ? <div className="ml-auto flex items-center gap-1">{menu}</div> : undefined}
      className={`flex h-full min-w-0 flex-col ${state === "error" ? "border-pd-danger" : ""}`}
      headerClassName="mb-3"
    >
      <div className="relative min-h-0 flex-1 overflow-hidden" data-state={state} aria-busy={state === "loading" || undefined}>
        {body}
      </div>
    </PdCard>
  )
}
