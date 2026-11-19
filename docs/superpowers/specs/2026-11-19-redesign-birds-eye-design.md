# Redesign: Agency Ops, Bird's Eye

Status: built on `feat/redesign-design-system` (draft PR #175), 2026-11-19.
Mock board: `mocks/redesign-tokens/12-birdseye.html` (outside the repo).

## What it is

The first agent page. Agency Ops (`/dashboard`) opens on Bird's Eye: the
headline figures, a per-day chart, who is doing best and where leads are lost.
With `?client=<id>` in the address it is the same page fed one client's numbers.
It replaces the old Portfolio Dashboard page at the same address.

## Decisions (the owner's picks, 2026-11-19)

| Decision | Pick |
|---|---|
| Layout | A, the reference: centred column, greeting and a one-line finding, four tiles, the chart, then a ranked list beside the funnel. The page scrolls. |
| Header tabs | All four shown (Chat, Bird's Eye, Dashboard, Suggestions). Dashboard and Suggestions are greyed until built. Chat opens today's Ask Birdy. |
| Ask bar | Left out until Chat is rebuilt. |
| Client view | Built in this step. A client row and the client switcher both land here. |

## Approaches considered

- A, the reference (picked): matches the locked design; Suggestions get their own tab later.
- B, one screen with no page scroll: denser, no greeting, drifts from the reference.
- C, the reference plus today's Suggestions rail: keeps Apply and Dismiss reachable now, at the cost of a narrower, busier page.

## Data

Nothing new on the backend. `usePortfolioData` gained a `clientId` argument
that narrows the client groups before any figure is computed, and a per-day
cost-per-lead series. What to draw is worked out in `src/lib/birds-eye.js`.

- Agency tiles: Ad spend, Leads, Closed, Leads called (called over leads from the funnel).
- Client tiles: Spend, Leads, CPL against the client's limit, Closed.
- Chart: Leads, Ad spend, Calls, Closed for the agency; CPL replaces Calls inside a client.
- Left card: top clients by cost per lead (agency), or the client's campaigns by cost per lead.
- Right card: the funnel and its diagnosis, from the existing `diagnoseFunnel`.
- Changes against a previous period exist only for Today and Last 7 days, as before.

## Known gaps

- The reference's dashed "previous period" line on the chart is not drawn: the per-day requests cover the chosen range only.
- Suggestions and the activity feed are not reachable on the branch until the Suggestions tab is built.
- The client card ranks campaigns, not individual ads: campaigns are what the client payload carries.
- `/clients/<id>` (the old client page) still exists and is linked from the client view as "Open client page"; it holds settings, notes and tracking.
- The old `components/portfolio` kit and `dashboard-controls` are now unused by this page and are removed with the other old layers at the end of the redesign.
