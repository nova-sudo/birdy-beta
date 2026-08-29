import { pdFontClass } from "@/lib/pd-fonts";

// ─── Sales Hub shell ────────────────────────────────────────────────────────
// The page-level frame the Sales Hub composes into: the design system's two
// typefaces scoped to this subtree, the canvas, and one scroll region at the
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
    <div className={`${pdFontClass} -m-4 flex min-h-0 flex-1 flex-col overflow-hidden md:-m-6`}>
      <div className="pd-scrolly min-w-0 flex-1 px-6 py-[22px]">{children}</div>
    </div>
  );
}

/**
 * The title block, as it appears in the global top bar.
 *
 * It carries the pd font variables itself: the page subtree that normally
 * provides them is below the header, not around it.
 */
export function SalesHubHeaderTitle({ title, subtitle }) {
  return (
    <div className={`${pdFontClass} min-w-0`}>
      <h1 className="truncate font-pd-display text-[19px] font-bold leading-none tracking-[-0.02em] text-pd-ink">
        {title}
      </h1>
      <p className="mt-1 truncate text-[12px] leading-none text-pd-faint">{subtitle}</p>
    </div>
  );
}
