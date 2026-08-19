import { pdFontClass } from "@/lib/pd-fonts";

// ─── Sales Hub shell ────────────────────────────────────────────────────────
// The page-level frame the Sales Hub redesign composes into: the design system's
// two typefaces scoped to this subtree, the canvas, and one scroll region at the
// design's 22/24 padding.
//
// The handoff draws a full 1600×1040 app frame — a 68px icon rail and a 64px
// header bar carrying the title, an Ask Birdy field, the date picker, a
// notification bell and an avatar. Birdy already renders every one of those
// globally from src/app/layout.jsx (AppSidebar + the search header +
// NotificationsDropdown + UserMenu), so rebuilding them here would put two nav
// systems and two search fields on one screen. The Portfolio Dashboard made the
// same call for the same reason (see src/app/dashboard/README.md, "Deviations
// from the handoff"), and this follows it so the two sibling screens sit in the
// app the same way.
//
// What is kept is everything the frame contained: the canvas, the title block —
// demoted from the header bar to an ordinary page heading, since the global
// header is already occupied by the Birdy wordmark on this route — and a single
// scroll region at the design's padding.

/**
 * @param {string} title page name, Poppins 700 19px
 * @param {string} subtitle the line beneath it, Inter 400 12px
 * @param {React.ReactNode} [action] right-hand slot on the title row
 */
export function SalesHubShell({ title, subtitle, action, children }) {
  return (
    // The layout's own p-4/md:p-6 is bled off so this screen controls its own
    // padding, the way the design specs it — one region, 22px 24px.
    <div className={`${pdFontClass} -m-4 flex min-h-0 flex-1 flex-col overflow-hidden md:-m-6`}>
      <div className="pd-scrolly min-w-0 flex-1 px-6 py-[22px]">
        <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-pd-display text-[19px] font-bold leading-none tracking-[-0.02em] text-pd-ink">
              {title}
            </h1>
            <p className="mt-1 text-[12px] leading-none text-pd-faint">{subtitle}</p>
          </div>
          {action}
        </div>
        {children}
      </div>
    </div>
  );
}
