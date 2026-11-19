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
| Header tabs | All four shown (Chat, Bird's Eye, Dashboard, Suggestions). Dashboard and Suggestions are greyed until built. |
| Ask bar | First left out; added the same day at the owner's request. Sending a question opens the conversation in a column beside the page, as the reference does. |
| Chat | Rebuilt at `/dashboard/chat` to the reference layout: saved conversations on the left, the open one on the right. |
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

## Chat and the ask bar (added 2026-11-19)

Both use the app's existing chat backend (`/api/chat`, `/api/chat/conversations`)
through `src/lib/chat-store.js`, so answers are real and the history is shared
with the older Ask Birdy page.

- Bird's Eye has a floating ask bar. The first question opens `AskPanel`, a column on the right; the page narrows beside it. Each client has its own thread. "Open in Chat" carries the conversation to the Chat tab.
- Chat: New chat, conversations grouped Today / Yesterday / This week / Earlier, delete on hover, starter prompts on an empty chat.
- Not in this step: the reference's scheduled "Morning roundup" messages and its inline client, ad and report tags, which need the agent work planned for other sessions. Forms, metric cards and charts inside a reply are drawn by the older chat blocks and keep their older look. File attachments and the client picker in the composer are not carried over.
