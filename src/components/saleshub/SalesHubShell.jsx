// ─── Sales Hub shell ────────────────────────────────────────────────────────
// The page-level frame the Sales Hub composes into: the sans typeface
// scoped to this subtree, the canvas, and one scroll region at the
// design's 22/24 padding.
//
// The handoff draws a full 1600×1040 app frame — a 68px icon rail and a 64px
// header bar carrying the title, an Ask Birdy field, the date picker, a
// notification bell and an avatar. Birdy already renders every one of those
// globally from src/app/layout.jsx, so rebuilding them here would put two nav
// systems and two search fields on one screen.
//
// What the design *does* get right is where the title and the filters belong:
// in that header bar, not on the page. So they are published into the global
// one instead — see the page, and components/page-header.jsx. This shell is
// what is left: the canvas and the scroll region.

export function SalesHubShell({ children }) {
  return (
    // The layout's own p-4/md:p-6 is bled off so this screen controls its own
    // padding, the way the design specs it — one region, 22px 24px.
    <div className="-m-4 flex min-h-0 flex-1 flex-col overflow-hidden font-sans md:-m-6">
      <div className="min-w-0 flex-1 overflow-y-auto px-6 py-6">{children}</div>
    </div>
  );
}

/**
 * The title block, as it appears in the global top bar.
 *
 * It sets the sans face itself: the page subtree that normally provides it
 * is below the header, not around it.
 */
export function SalesHubHeaderTitle({ title, subtitle }) {
  return (
    <div className="min-w-0 font-sans">
      <h1 className="truncate text-xl font-semibold leading-none text-foreground">
        {title}
      </h1>
      <p className="mt-1 truncate text-xs leading-none text-muted-foreground">{subtitle}</p>
    </div>
  );
}
