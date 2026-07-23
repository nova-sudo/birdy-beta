# Data Model & API

How the birdy-ai stack organizes media-buying data, and where to pull it. Read this when you're
shaping data the user gave you, or fetching it yourself (only if you have the app's auth token /
tools — this Claude usually won't, so default to analyzing what the user provides).

## The hierarchy

```
Client Group  (one client / brand — has a Meta ad account, a GHL location, a HotProspector account)
  └── Campaign        (Meta: objective + budget strategy)
        └── Ad Set    (Meta: audience, placements, budget, optimization event)
              └── Ad  (Meta: the creative)
                    └── Leads  (people who converted — matched into GHL, worked in HotProspector)
```

A **Client Group** is the unit of a "client". It ties together the three integrations:

```jsonc
{
  "id": "…",
  "name": "Acme Dental",
  "ghl_location_id": "…",          // links to GoHighLevel
  "meta_ad_account_id": "act_…",   // links to Meta Ads
  "ad_account_currency": "USD",    // ← currency for all Meta $ metrics on this client
  "status": "active",
  "facebook": {
    "ad_account_id": "act_…",
    "currency": "USD",
    "total_leads": 0,
    "campaigns": [ /* rows with spend, ctr, cpl, results, status, … */ ],
    "adsets":    [ /* same metric shape, plus campaign linkage */ ],
    "ads":       [ /* same metric shape, plus adset linkage */ ],
    "metrics":   { /* account-level rollup for the window */ },
    "date_preset": "last_7d"
  },
  "gohighlevel":  { /* opportunities, revenue, contacts */ },
  "hotprospector":{ /* call-center stats */ }
}
```

Two facts that shape every analysis:

- **Everything is date-windowed.** Meta data is cached per date preset (`last_7d`, `last_30d`, etc.).
  "This week" and "last 30 days" are different documents — always know which window you're in, and
  don't compare across windows without saying so.
- **Currency is per client.** All Meta money metrics are in that client's `account_currency`. Never
  compare or sum dollars across clients with different currencies without converting.

## Where each metric comes from

| Source | Metrics | The question it answers |
|--------|---------|--------------------------|
| **Meta Ads** | spend, impressions, reach, frequency, clicks, ctr, cpc, cpm, results, leads, cpl, cost_per_result | Did the ad buy attention and leads efficiently? |
| **GoHighLevel** | contacts, opportunities (open/won/lost/abandoned), pipeline stage, opportunity value, revenue, tags, source | Did the lead become pipeline and money? |
| **HotProspector** | calls (inbound/outbound), connect/answer rate, talk time, transfers, appointments | Did anyone reach and work the lead? |

The whole stack exists to join these three so you can judge an ad on revenue, not just CPL.

## Backend endpoints

Base URL: `https://birdy-backend.vercel.app` (or `NEXT_PUBLIC_API_URL`). Requests are authenticated
with a bearer token (`Authorization: Bearer <auth_token>`); see `src/lib/api.js`. **Only call these
if the runtime actually has a valid token** — otherwise work from user-provided data.

| Endpoint | Returns | Use for |
|----------|---------|---------|
| `GET /api/client-groups` | All client groups, each with `facebook.campaigns/adsets/ads` for the preset | The account-level and hierarchy data — the backbone of most analyses |
| `GET /api/client-groups/{id}` | One client's raw `group_info` (normalize via `src/lib/normalize-group.js`) | Deep-dive on a single client |
| `GET /api/campaigns/opp-rollup?groups={ids}&start_date=&end_date=` | GHL opportunities/revenue rolled up **per campaign** | Joining Meta campaigns to GHL outcomes (ROAS, won opps) |
| `GET /api/campaigns/tag-rollup?groups={ids}` | GHL tag counts per campaign | Tag-based lead qualification analysis |
| `GET /api/facebook-leads/filtered?groups={ids}&limit=&start_date=&end_date=` | Individual **leads** with ad/campaign attribution + GHL match/status | Lead-level and lead-quality analysis |
| `GET /api/leads/unified` + `GET /api/leads/filter-options` | Unified lead list + available filters | Cross-source lead views |
| `GET /api/hotprospector/call-center` | Call-center leads with embedded call logs | Connect rate, coverage, zombie detection |
| `GET /api/hotprospector/members/dashboard` | Per-agent call stats | Separating lead-quality from call-effort problems |
| `GET /api/dashboard/summary` | Account KPI summary | Quick top-line health |
| `GET /api/custom-metrics` | User-defined formula metrics | Respect and reuse the client's own custom metrics |
| `POST /api/facebook/update-status` | `{ object_id, object_type: "campaign"\|"adset"\|"ad", status: "ACTIVE"\|"PAUSED" }` | The **only mutation** — pausing/activating an object |

## Lead object shape

From `/api/facebook-leads/filtered` — one row per lead, already joined across Meta and GHL:

| Field | Meaning |
|-------|---------|
| `full_name`, `email`, `phone_number` | Contact identity |
| `ad_name`, `adset_name`, `campaign_name` | **Which ad produced this lead** — the attribution that lets you score creatives on quality |
| `platform` | facebook / instagram |
| `created_time` | When the lead came in |
| `group_name` | Which client |
| `ghl_matched` | Did this lead land in GHL? (`false` ⇒ attribution gap or lost lead) |
| `ghl_opportunity_status` | open / won / lost / abandoned |
| `ghl_opportunity_value` | $ value of the opportunity |
| `ghl_tags` | Qualification/segmentation tags |
| `ghl_date_added` | When it entered GHL |

To score an ad on quality, group leads by `ad_name` / `adset_name` and look at the distribution of
`ghl_matched`, `ghl_opportunity_status`, and `ghl_opportunity_value` — plus the matching
HotProspector connect data. High lead count with mostly-unmatched or open-forever opportunities and
low connect rate = a **zombie-lead** ad.

## Taking action (only when asked to draft exact changes)

The one write path is `POST /api/facebook/update-status`. When the user wants concrete moves rather
than just advice, specify them as `{ object_type, object_id, status }` triples (e.g., "pause ad
`120…` — CPL $47 on $780 spend, 0 opportunities"). **Recommend; don't assume execution.** Pausing a
client's live ad spends (or stops spending) real money — never imply it's been done, and surface the
exact objects and the reasoning so a human can approve. Budget changes and new audiences/creatives
aren't API-exposed here, so draft those as instructions for the buyer to apply in Meta Ads Manager.
