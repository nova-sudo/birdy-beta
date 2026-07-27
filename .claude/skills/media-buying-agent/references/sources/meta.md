# Source: Meta Ads

**Role in the funnel:** the buying surface — the top of the funnel where spend becomes impressions,
clicks, and leads. Everything downstream (GHL, HotProspector) judges what Meta produced.

## Hierarchy

```
Client Group  (one client — owns a Meta ad account, a GHL location, a HotProspector account)
  └── Campaign        objective + budget strategy (CBO vs ABO)
        └── Ad Set    audience, placements, budget, optimization event, schedule
              └── Ad  the creative (hook, format, copy, CTA)
                    └── Leads  people who converted (matched into GHL, worked in HotProspector)
```

Two facts that shape every analysis:
- **Everything is date-windowed.** Meta data is cached per preset (`last_7d`, `last_30d`, …). "This
  week" and "last 30 days" are different documents — always know which window you're in.
- **Currency is per client** (`account_currency`). Never sum or compare dollars across clients with
  different currencies without converting.

## Client Group object shape

```jsonc
{
  "id": "…", "name": "Acme Dental",
  "ghl_location_id": "…", "meta_ad_account_id": "act_…",
  "ad_account_currency": "USD", "status": "active",
  "facebook": {
    "ad_account_id": "act_…", "currency": "USD", "total_leads": 0,
    "campaigns": [ /* metric rows */ ], "adsets": [ … ], "ads": [ … ],
    "metrics": { /* account-level rollup */ }, "date_preset": "last_7d"
  },
  "gohighlevel": { … }, "hotprospector": { … }
}
```

## Metrics (this source owns these)

| id | Name | Definition | Diagnoses | Directional benchmark |
|----|------|------------|-----------|-----------------------|
| `spend` | Spend | Amount spent (account currency) | Where money goes; the weight on everything | anchor to budget/target |
| `impressions` | Impressions | Times shown | Delivery volume | — |
| `reach` | Reach | Unique people | Audience actually hit | — |
| `frequency` | Frequency | `impressions / reach` | **Fatigue / saturation** | <2 healthy; 2.5–3 watch; >3–4 fatigue likely |
| `clicks` | Clicks | Clicks (link clicks for CTR) | Interest | — |
| `ctr` | CTR (%) | `clicks / impressions × 100` | **Creative & offer resonance** | feed link: <0.8% weak, ~1% ok, 2%+ strong |
| `cpc` | CPC ($) | `spend / clicks` | Cost of interest; `≈ CPM/(CTR×10)` | decompose, no absolute |
| `cpm` | CPM ($) | `spend / impressions × 1000` | **Impression cost** — audience competitiveness, quality ranking, seasonality | rising over time = fatigue/quality drop |
| `cpp` | CPP | `spend / reach × 1000` | Reach efficiency | — |
| `results` | Results | Count of optimization event | The outcome being bought | anchor to target volume |
| `leads` | Leads | Lead results | Lead volume | — |
| `cpl` | CPL ($) | `spend / leads` | **Headline efficiency** | anchor to client target CPL |
| `cost_per_result` | Cost Per Result ($) | `spend / results` | Efficiency (non-lead results) | anchor to target CPA |
| `conversion_rate_ranking` | Conv. Rate Ranking | Meta's below/avg/above ranking | Post-click competitiveness | "below average" ⇒ landing/offer problem |
| `frequency`, `social_spend`, `account_currency`, `status` | — | see above / self-explanatory | — | — |

Client-dashboard roll-up variants (same meaning, `meta_` prefix): `meta_spend`, `meta_impressions`,
`meta_clicks`, `meta_reach`, `meta_ctr`, `meta_cpc`, `meta_cpm`, `meta_leads`, `meta_campaigns`,
`meta_cpl`, `meta_results`.

## Lead object (`/api/facebook-leads/filtered`)

One row per lead, joined across Meta + GHL: `full_name`, `email`, `phone_number`, `ad_name`,
`adset_name`, `campaign_name`, `platform` (facebook/instagram), `created_time`, `group_name`,
`ghl_matched`, `ghl_opportunity_status`, `ghl_opportunity_value`, `ghl_tags`, `ghl_date_added`.
Group by `ad_name` / `adset_name` to score creatives/audiences on downstream quality.

## Endpoints (birdy backend, `https://birdy-backend.vercel.app`, bearer auth)

| Endpoint | Returns | Use for |
|----------|---------|---------|
| `GET /api/client-groups` | All clients w/ `facebook.campaigns/adsets/ads` for the preset | Backbone data |
| `GET /api/client-groups/{id}` | One client's raw `group_info` (normalize via `src/lib/normalize-group.js`) | Deep dive |
| `GET /api/facebook-leads/filtered?groups=&limit=&start_date=&end_date=` | Individual leads + GHL match | Lead-level analysis |
| `POST /api/facebook/update-status` | body `{ object_id, object_type: "campaign"\|"adset"\|"ad", status: "ACTIVE"\|"PAUSED" }` | **The only mutation** — pause/activate |

## Taking action

The one write path is `POST /api/facebook/update-status`. Pausing a live object moves real money —
**recommend, don't assume execution**, surface the exact `{object_type, object_id, status}` and the
reason, and leave approval to a human. Budget changes and new audiences/creatives aren't API-exposed;
draft those as instructions for Meta Ads Manager.
