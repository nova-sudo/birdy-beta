# Bytes DS migration: regressions log

Phase 0 crawl, 2026-10-24, at 1440px against the local backend on :8001. Phase 0 restyles every page only through the token aliases, so this list covers what that pass broke or left visibly off, and which phase fixes it.

| Route | Problem | Fixed in |
|---|---|---|
| `/_ds` (390) | `BirdyRead` overflowed its grid cell, which clipped the action buttons | Phase 0: `Frame` root gets `min-w-0` |
| `/_ds` | Radius swatches were `bg-muted` on a muted page, so invisible | Phase 0: showcase swatches get a border and a white fill |
| all (390) | The top bar search pill and icons overflow the header at phone width | Phase 1 (shell) |
| `/dashboards/[id]` | Widgets show "Method Not Allowed" from the local backend. This is a backend or API mismatch, not styling. | Not ds. Check against the deployed API. |
| `/_ds`, hubs | Console: `StatTile` spreads a `key` prop (`portfolio/StatStrip`); an unknown `onOpenChange` reaches a DOM node. Both come from code not touched on this branch. | Hub phases (StatStrip is replaced) |
| `/_ds` | The metric tabs chart has no y-axis labels or legend; Paper's "Metric tabs + chart" has both | Hub phases (Task 11+) |

Crawled with no token breakage: `/dashboard`, `/clients`, `/clients/[id]`, `/clients/[id]/tracking`, `/Sales-Hub`, `/campaigns`, `/contacts`, `/metrics`, `/alerts`, `/ask-birdy`, `/dashboards`, `/dashboards/[id]`, `/settings`, `/billing`, `/billing/terms-of-service`, `/changelog`, `/login`.

Not reachable with this account: `/admin/*` (redirects to `/dashboard`, account is not an admin), `/onboarding` (already onboarded, redirects to `/clients`), `/credits` (redirects to `/billing`), `/register` (signed in), `/install/[siteId]` (needs a site id). These need checking in Phases 7–9.

Note for future crawls: the first screenshot after a navigation catches the page's fade-in at partial opacity. Take a throwaway capture, wait one second, then capture again.

## Dev-only hydration warning (2026-10-24)

Every page logs a React hydration mismatch on `next dev`: Radix `useId` values in the shell (sidebar account menu, search dialog) differ between server HTML and the client. It does not happen in the production build. With `next build && next start`, the account menu trigger's id equals the `aria-labelledby` the opened menu points back to. On `next dev` the two differ. So the dev server renders the tree one branch deeper on the server than on the client, and the app code is not the cause. A layout change (2c82b72) only moved the ids, so it was reverted (72941ff). Ignore this warning in dev crawls. If it ever shows up in a production build, investigate it then.
