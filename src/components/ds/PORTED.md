# Ported from Bytes

Source: `apps/dashboard/src/components/` at `aaefe2dd08` (read-only reference kit).
Common to every row: TS to JS with JSDoc props, `cn` from `@/lib/utils`, lucide icons, token utilities only, `data-ds` on the root.

| File | Source @ aaefe2dd08 | Stripped | Local changes |
| --- | --- | --- | --- |
| primitives/button.jsx | ui/button.tsx | `permissions` prop and PermissionGate wrapper, Next Link href handling, icon/effect/badge props, ten extra variants and sizes, @remixicon/react icons | Bytes cva structure kept. Variants primary/outline/ghost/secondary/destructive/link (primary replaces Bytes `default`, no alias). Sizes sm/md/lg/icon-sm/icon on control heights. CSS press (90ms down, 160ms ease-press release). `loading` overlays a spinner and sets aria-busy. `asChild` via Radix Slot |
| primitives/input.jsx | ui/input.tsx | none | Control height and `shadow-control`, focus `shadow-control-focus`, invalid ring in danger. API unchanged |
| primitives/textarea.jsx | ui/textarea.tsx | none | Same re-skin as input. API unchanged |
| primitives/select.jsx | ui/select.tsx | @remixicon/react icons, `description` prop on SelectItem | Lucide icons. `size` default/sm maps to control heights. Content uses `shadow-floating`. Same export names as `components/ui/select` |
| primitives/checkbox.jsx | ui/checkbox.tsx | @remixicon/react icons, framer-motion check animation | Lucide check. Primary fill when checked, `shadow-control` ring |
| primitives/switch.jsx | ui/switch.tsx | none | Primary track when on, border-colour track when off, `shadow-control` thumb |
| primitives/label.jsx | ui/label.tsx | none | Token colours only |
| primitives/badge.jsx | ui/badge.tsx | PermissionGate, `permissions` prop, tooltip prop, asChild, 20 status-named variants | Replaced by `tone` (neutral/primary/success/warning/danger/info) x `variant` (soft/dot). Soft is `-soft` fill with `-ink` text |
| primitives/tabs.jsx | ui/tabs.tsx | none (Bytes file is the Radix wrapper) | Underline style: hairline list, primary bar on active trigger. Same four exports |
| primitives/segmented-tabs.jsx | composed/segmented-tabs.tsx | tooltip per option, @remixicon/react info icon, `badge` string | Rebuilt: muted track, white `shadow-control` thumb sliding via framer-motion `layoutId` spring (damping 22, stiffness 260). Props `value/onValueChange/items[{value,label,count}]/size` replace `value/onChange/options` |
| primitives/kbd.jsx | ui/coss/kbd.tsx | none | `rounded-sm`, token colours. Exports Kbd and KbdGroup |
| surfaces/frame.jsx | ui/frame.tsx | border/description/href/footer/tone props, FrameAction, @remixicon/react icon, useId | Rebuilt to Paper: `bg-muted rounded-frame`, header row with title 16/600 (h2, `titleAs`), `meta`, `actions`, children below |
| surfaces/surface.jsx | ui/card.tsx | PermissionGate, `permissions` prop, tooltip import, Card sub-parts (header/title/content/footer/action) | Single `Surface`: `bg-background rounded-surface shadow-surface`, `as`, `padded` |
| surfaces/notice.jsx | composed/notice.tsx | none | Tones info/success/warning/danger/neutral on soft + ink tokens, `title`, `role="status"`, action trailing right |
| surfaces/empty-state.jsx | ui/empty-state.tsx | `ui/empty.tsx` parts, size prop | Flattened to one component; `icon` takes a lucide component or node. `ui/empty.tsx` not ported |
| surfaces/error-state.jsx | composed/error-state.tsx | clientConfig dev-only error detail, @remixicon/react icon, `error`/`message` props | Layout and copy from `portfolio/LoadError` (defaults "Couldn't load this" / "The request failed."); retry uses ds Button; `description` replaces `message` |
| surfaces/skeleton.jsx | ui/skeleton.tsx | none | `bg-muted rounded-control`, pulse off under reduced motion |
| surfaces/spinner.jsx | ui/spinner.tsx (re-export of `@bytes/ui/ui/spinner`) | the `@bytes/ui` import | Written locally: lucide `Loader2`, `size` px, `label` gives role="status" + sr-only text, else aria-hidden |
| overlays/dialog.jsx | ui/dialog.tsx | none (Bytes file is the Radix wrapper) | Same ten export names as `components/ui/dialog`. Content `rounded-overlay shadow-overlay`, overlay `bg-scrim` fading 200ms, title 18/600 |
| overlays/confirm.jsx | ui/danger-dialog.tsx + ui/confirmer.tsx | the hook/context provider plumbing, i18n strings, @remixicon/react icons | Imperative `confirm({title, description, confirmLabel, cancelLabel, tone}) -> Promise<boolean>` on a module-level queue, rendered by `<ConfirmHost/>` over Radix AlertDialog. Escape and cancel resolve false; `tone="danger"` (default) uses the destructive Button. Rejects if no host is mounted |
| overlays/sheet.jsx | ui/sheet.tsx | none (Bytes file is the Radix wrapper) | Sides right/bottom/left (no top), default right, `data-side` on content. Below 768px right renders as bottom. 320ms `ease-edge` slide, 200ms backdrop, tw-animate-css, off under reduced motion. Same eight exports as `components/ui/sheet` |
| overlays/popover.jsx | ui/popover.tsx | `animate-ui/` wrapper, framer-motion | Flattened to plain Radix with data-state classes. `rounded-surface shadow-floating`. Same four exports as `components/ui/popover` |
| overlays/dropdown-menu.jsx | ui/dropdown-menu.tsx | `animate-ui/` wrapper, framer-motion, @remixicon/react icons, PermissionGate on items | Flattened to plain Radix. Lucide check/circle indicators, destructive variant on danger tokens, content `shadow-floating`. Same fifteen exports as `components/ui/dropdown-menu` |
| overlays/tooltip.jsx | ui/tooltip.tsx | `animate-ui/` wrapper, framer-motion | Flattened to plain Radix. `bg-foreground text-background shadow-floating`, default side top. Same four exports as `components/ui/tooltip` |
| overlays/command.jsx | ui/command.tsx | @remixicon/react icons | cmdk wrapper on tokens; `CommandDialog` uses the ds Dialog. Same nine exports as `components/ui/command` |
| overlays/toaster.jsx | ui/sonner.tsx | next-themes `useTheme` (light only) | Sonner with token classes (`shadow-floating`, `rounded-surface`, `font-sans`). Re-exports `toast` from sonner |
| data/delta.jsx | charts/comparison-delta.tsx | `MetricComparison` object, lucide arrow icons | Takes a signed `value`; literal ↑/↓ spans, `invert`, `format`, `suffix`; success-ink / danger-ink / muted. Replaces portfolio `DeltaPill` |
| data/metric-card.jsx | charts/metric-card.tsx | Link/tooltip chrome, date-fns, `DailyMetricPoint` data | Label, `text-figure` value, Delta, caption, recharts sparkline in chart-1 |
| data/metric-group.jsx | charts/metric-card-group.tsx | Skeleton wiring | Muted frame with title/meta/action over an auto-fit grid of MetricCard. Replaces `StatStrip`/`StatTile` |
| data/metric-tabs-chart.jsx | charts/board-trend-chart.tsx, charts/chart-tooltip.tsx, ui/chart.tsx | `ChartContainer` config layer, i18n, board data types | Tablist of figures rising into a white recharts panel; current chart-1 with 14% fill, previous dashed `4 5`; 800ms draw, 120ms tooltip; `fromPortfolioTabs` adapter for `portfolio/MetricTabsChart` props |
| data/breakdown.jsx | Paper-only, no Bytes source | n/a | Segmented share bar plus rows (colour dot, Delta, value, share) |
| data/bar-list.jsx | charts/bar-list.tsx | Links, i18n | Capsule bars scaled to the max; `primary-soft` fill. Replaces `Leaderboard` (rank badges dropped) |

Note (data/bar-list, data/breakdown): `Leaderboard` callers that need per-row deltas move to `Breakdown`; `BarList` drops the rank badge, row meta and delta.
