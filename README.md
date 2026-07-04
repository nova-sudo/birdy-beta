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
- **Calls** — the most recent individual calls across leads, newest first. There is no dedicated backend endpoint for a flat "all calls" feed, so this tab fetches a batch of leads from the same `/api/hotprospector/call-center` endpoint the Leads tab uses, flattens each lead's embedded call logs, and sorts them by call time. The number of calls shown is configurable via the "Show last N recent calls" input above the table (5–100, default 20); the value is persisted per-browser in `localStorage` under `STORAGE_KEYS.SALES_HUB_CALLS_LIMIT`.

All tabs share the same layout: a `Tabs`/`TabsList` header, a search box + column-visibility dropdown toolbar, and a `StyledTable` (`src/components/ui/table-container.jsx`) for the data grid.

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
