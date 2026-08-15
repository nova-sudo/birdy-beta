This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [https://birdy-backend.vercel.app](https://birdy-backend.vercel.app) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Hubs & Tabs

### Sales Hub (`src/app/Sales-Hub/page.jsx`)

Call-center performance across HotProspector clients. Tabs:

- **Overview** — one row per client, windowed call KPIs (leads called, total/inbound/outbound calls, transfers). Click a row to drill into Leads for that client.
- **Leads** — one row per lead, with a "Call Logs" dialog showing every call for that lead. Server-paginated (15/page).
- **Members** — account-wide HotProspector team performance for the selected date window.
- **Calls** — the most recent individual calls across leads, newest first. There is no dedicated backend endpoint for a flat "all calls" feed, so this tab fetches a large batch of leads from the same `/api/hotprospector/call-center` endpoint the Leads tab uses, flattens each lead's embedded call logs, and sorts them by call time. The number of calls shown is configurable via the "Show last N recent calls" input above the table (5–100, default 20); the value is persisted per-browser in `localStorage` under `STORAGE_KEYS.SALES_HUB_CALLS_LIMIT`.

  **Known limitation**: `/api/hotprospector/call-center` sorts leads by lead *creation* date, not by call recency, so no batch size fully guarantees the true most-recent calls surface — the tab over-fetches (up to `MAX_LEADS_TO_FETCH` leads, see `src/app/Sales-Hub/page.jsx`) as a heuristic to make this unlikely in practice. A correct fix would need a backend aggregation that filters/sorts by call time server-side; the backend does already have a `GET /api/call_logs?group_id=` endpoint that does this correctly, but it's currently GHL-only — HotProspector-provider clients short-circuit to an empty result until that integration is extended.

All tabs share the same layout: a `Tabs`/`TabsList` header, a search box + column-visibility dropdown toolbar, and a `StyledTable` (`src/components/ui/table-container.jsx`) for the data grid.

### Portfolio Dashboard (`src/app/portfolio/page.jsx`)

Agency-level view across every client: portfolio KPIs, a switchable trend chart,
a client leaderboard, a diagnostic funnel, call-centre metrics, and a rail of
Birdy suggestions and activity. Built from the `variant 3e` design handoff.

It runs on its own `pd-*` design tokens (declared in `src/app/globals.css`) and
its own typefaces, both scoped to the route — see
[`src/app/portfolio/README.md`](src/app/portfolio/README.md) for the backend
contract, the shared-state model, and the deliberate deviations from the design.

## Billing & Payments (Whop)

Billing runs on [Whop](https://docs.whop.com/). New subscriptions use Whop's
[embedded checkout](https://docs.whop.com/payments/checkout-embed) (`@whop/checkout/react`)
rendered in a modal on `src/app/billing/page.jsx` — no payment SDK is loaded from a CDN and
no card data touches this app. Plan changes and cancellations happen in Whop's hosted
customer portal (the membership `manage_url`), because Whop has no in-place "swap the plan"
API the way Paddle did.

> **Whop setup:** configure Starter / Growth / Scale as three **plans under a single Whop
> product (access pass)** so the customer portal can switch a member between them. Extra
> client slots are a separate recurring plan (the Scale add-on).

### Frontend environment variables

| Variable | Example | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_WHOP_ENVIRONMENT` | `sandbox` \| `production` | Defaults to `production`. Use `sandbox` for [Whop test mode](https://docs.whop.com/developer/guides/sandbox). |
| `NEXT_PUBLIC_WHOP_PLAN_STARTER` | `plan_XXXXXXXX` | Whop plan ID for the Starter plan. |
| `NEXT_PUBLIC_WHOP_PLAN_GROWTH` | `plan_XXXXXXXX` | Whop plan ID for the Growth plan. |
| `NEXT_PUBLIC_WHOP_PLAN_SCALE` | `plan_XXXXXXXX` | Whop plan ID for the Scale plan. |
| `NEXT_PUBLIC_WHOP_PLAN_EXTRA_CLIENT` | `plan_XXXXXXXX` | *(Optional)* Whop plan ID for the Scale extra-client-slot add-on. Hides the add-slot button when unset. |

Find a plan ID in the Whop dashboard: **Checkout Links → ⋯ → Details → `plan_XXXXXXXX`**.

> The previous `NEXT_PUBLIC_PADDLE_*` variables (`_CLIENT_TOKEN`, `_ENVIRONMENT`,
> `_PRICE_STARTER/GROWTH/SCALE`, `_PRICE_EXTRA_CLIENT`) are no longer read and can be removed.

### Backend (separate `birdy-backend` service)

The API at `NEXT_PUBLIC_API_URL` owns subscription state. Its Whop migration lives in
`birdy-backend/billing.py` (official `whop-sdk`; Standard-Webhooks verification). Endpoints the
frontend calls:

- `GET /api/billing/status` — `{ subscribed, plan, status, client_count, client_limit, extra_clients_paid, can_add_extra_slots, current_period_end, cancel_at_period_end }`, derived from the Whop membership stored on the user.
- `GET /api/billing/portal-url` — `{ portal_url }`, the membership's Whop `manage_url` (plan change / update card / cancel).
- `POST /api/billing/webhook` — verifies the Standard-Webhooks signature and, on `membership.activated` / `membership.deactivated` (and payment events), rebuilds the stored subscription. This is what activates a plan after checkout. *(The Paddle `change-plan` endpoint was removed — plan changes go through the portal.)*

Backend env: `WHOP_API_KEY` (Company API key), `WHOP_WEBHOOK_SECRET`, and
`WHOP_PLAN_STARTER` / `_GROWTH` / `_SCALE` (+ optional `_EXTRA_CLIENT`).

**Purchase → account linking:** the account id (`user_id`) *is* the email, and checkout
prefills the signed-in user's email, so the webhook reconciles by the buyer's Whop email. If a
checkout session sets `metadata.user_id`, that is preferred — create one via the backend
[checkout-configuration API](https://docs.whop.com/api-reference/checkout-configurations/create-checkout-configuration)
and pass its id as `sessionId` to `<WhopCheckoutEmbed>` for an exact link.

## Testing

This project uses [Vitest](https://vitest.dev/) + [React Testing Library](https://testing-library.com/react). Run the suite with:

```bash
npm run test
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
