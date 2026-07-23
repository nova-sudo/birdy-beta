# Metrics Glossary

Every metric this stack exposes, its exact meaning, what it diagnoses, and a directional
benchmark. **Benchmarks are starting points — the client's own target and history always win.**
The `id` column is the field name you'll see in the birdy data and metric picker, so use these
exact names when referring to a metric.

Table of contents:
- [Meta Ads metrics](#meta-ads-metrics) — the buying surface
- [GoHighLevel (GHL) metrics](#gohighlevel-ghl-metrics) — the CRM / outcomes
- [HotProspector metrics](#hotprospector-call-center-metrics) — the call center
- [Derived / true-north metrics](#derived--true-north-metrics) — what the client actually cares about
- [Reading the metrics together](#reading-the-metrics-together)

---

## Meta Ads metrics

Available at every level of the hierarchy (campaign, ad set, ad) and rolled up at the account.

| id | Name | Definition | What it diagnoses | Directional benchmark |
|----|------|------------|-------------------|-----------------------|
| `spend` | Spend | Amount spent in the account currency | Where money is going. The weight on every other metric. | — (anchor to budget/target) |
| `social_spend` | Social Spend | Spend attributed to social/engagement placements | Placement mix | — |
| `impressions` | Impressions | Times the ad was shown | Delivery volume | — |
| `reach` | Reach | Unique people who saw the ad | Audience size actually hit | — |
| `frequency` | Frequency | `impressions / reach` — avg times each person saw it | **Ad fatigue / audience saturation** | <2 healthy for prospecting in a window; ~2.5–3 watch; >3–4 fatigue likely |
| `clicks` | Clicks | Clicks on the ad (link clicks for CTR context) | Interest generated | — |
| `ctr` | CTR (%) | `clicks / impressions × 100` | **Creative & offer resonance** (the hook) | Feed link CTR: <0.8% weak, ~1% ok, 2%+ strong (varies by objective/niche) |
| `cpc` | CPC ($) | `spend / clicks` | Cost of interest; `≈ CPM / (CTR×10)` | Decompose into CPM × CTR; no absolute target |
| `cpm` | CPM ($) | `spend / impressions × 1000` | **Impression cost** — audience competitiveness, quality ranking, seasonality | Rising CPM over time = fatigue or worsening quality ranking; absolute value is niche/geo-specific |
| `cpp` | CPP | Cost per 1,000 people reached (`spend / reach × 1000`) | Reach efficiency vs CPM | — |
| `results` | Results | Count of the campaign's optimization event (usually leads) | The outcome being bought | — (anchor to target volume) |
| `leads` | Leads | Lead results specifically | Volume of leads generated | — |
| `cpl` | CPL / Cost Per Lead ($) | `spend / leads` | **Headline efficiency** for lead-gen | Anchor to the client's target CPL; segment before trusting a blended number |
| `cost_per_result` | Cost Per Result ($) | `spend / results` | Efficiency when the result isn't a "lead" | Anchor to target CPA |
| `conversion_rate_ranking` | Conversion Rate Ranking | Meta's relative ranking (below/avg/above average) | Post-click competitiveness vs other advertisers | "Below average" flags a landing/offer problem |
| `account_currency` | Currency | The ad account's currency | **Never mix currencies across accounts** | — |
| `meta_conversion` | Meta Conversion (%) | Conversion rate on Meta's side | Click→result efficiency | — |
| `status` | Status | Active / Paused (per object) | Whether the object is live; the lever you toggle | — |

Client-dashboard roll-up variants (same meaning, prefixed `meta_`): `meta_spend`, `meta_impressions`,
`meta_clicks`, `meta_reach`, `meta_ctr`, `meta_cpc`, `meta_cpm`, `meta_leads`, `meta_campaigns`,
`meta_cpl`, `meta_results`.

## GoHighLevel (GHL) metrics

The CRM layer — this is where a lead becomes (or fails to become) money. Available on client rows and,
via the opportunity roll-up, per campaign.

| id | Name | Definition | What it diagnoses |
|----|------|------------|-------------------|
| `ghl_leads` / `ghl_contacts` | GHL Leads / Contacts | Contacts in GHL for the client | Did Meta leads actually land in the CRM? |
| `ghl_total_opps` | Total Opps | Opportunities created | How many leads became real pipeline |
| `ghl_won_opps` | Won Opps | Opportunities marked won | Closed business — the numerator of value |
| `ghl_lost_opps` | Lost Opps | Opportunities marked lost | Disqualification / loss rate |
| `ghl_open_opps` | Open Opps | Still in pipeline | Live pipeline yet to resolve |
| `ghl_abandoned_opps` | Abandoned Opps | Opportunities abandoned | Follow-up failure / dead pipeline (a zombie signal) |
| `ghl_revenue` | GHL Revenue | Revenue booked in GHL | **The top line for ROAS** |
| `ghl_conversion` | GHL Conversion (%) | Lead → won conversion | True close rate behind the ads |
| `ghl_opportunity_status` | Opp Status | open / won / lost / abandoned (per lead) | Where each lead sits in the funnel |
| `ghl_opportunity_value` | Opp Value | $ value on the opportunity (per lead) | Lead value, for value-weighted analysis |
| `ghl_matched` | GHL Match | Whether a Meta lead matched a GHL contact | **Attribution integrity** — unmatched leads can't be judged on outcome |
| `ghl_tags` / tags | Tags | GHL tags on the contact | Segmentation, qualification, custom lead states |
| `ghl_pipeline_stage` | Pipeline Stage | Stage in the pipeline | Funnel progression |
| `ghl_date_added` | GHL Date Added | When the contact entered GHL | Speed-to-CRM, cohorting |
| `source` | Source | Lead source | Channel/campaign attribution in GHL |

## HotProspector (call center) metrics

Whether anyone actually worked the lead. This is the difference between a lead and a conversation.

Per-client, date-windowed:

| id | Name | Definition | What it diagnoses |
|----|------|------------|-------------------|
| `hp_leads` | Call Center Leads | Leads in HotProspector | Leads that reached the call center |
| `hp_total_calls` | Total Calls | All calls placed/received | Call volume/effort |
| `hp_inbound` | Inbound Calls | Calls from leads | Lead-initiated interest |
| `hp_outbound` | Outbound Calls | Calls to leads | Follow-up effort |
| `hp_transfers` | Call Transfers | Calls transferred (e.g., to closer) | Hand-off volume — often a booked/qualified signal |
| `hp_leads_with_calls` | Leads Called | Distinct leads that got ≥1 call | **Coverage** — were leads actually worked? Low = zombie risk |
| `hp_answered_calls` | Answered Calls | Calls answered | Reachability |
| `hp_talk_time` | Talk Time (min) | Total talk minutes | Depth of engagement |
| `hp_connect_rate` | Connect Rate (%) | Connected / attempted | **Lead reachability & phone-number quality** — a top lead-quality signal |
| `hp_answer_rate` | Answer Rate (%) | Answered / placed | Reachability from the other side |

Per-agent, account-wide (team performance, not per-ad): `hp_agent_outbound`, `hp_agent_inbound`,
`hp_agent_dialed`, `hp_agent_answered`, `hp_agent_convos`, `hp_agent_appts` (appointments set),
`hp_agent_talk_min`, `hp_agent_sms`, `hp_agent_answer_rate`. Use these to separate a *lead-quality*
problem from a *call-center-effort* problem: if connect rate is low but agents are dialing hard, the
leads (and thus the ad/audience) are the issue; if leads aren't being called at all, that's an
operations issue, not a media-buying one — say so rather than blaming the ad.

## Derived / true-north metrics

Not always columns in the data — you often compute these. They're what the client actually pays for,
so reframe raw CPL into these whenever the data allows.

| Metric | Formula | Why it beats raw CPL |
|--------|---------|----------------------|
| **ROAS** | `ghl_revenue / spend` | The only metric that says whether the ad made money. A profitable ad at a "high" CPL beats a cheap ad that never closes. |
| **Cost per qualified lead** | `spend / (leads that became opportunities)` | Strips out zombies and junk leads. |
| **Cost per booked call / appointment** | `spend / appointments` | Ties spend to a real sales event. |
| **Cost per won opp (CPA)** | `spend / ghl_won_opps` | Cost of actual closed business. |
| **Lead→opp rate** | `ghl_total_opps / leads` | Quality of the lead at the top of the funnel. |
| **Connect rate** | `hp_connect_rate` | Whether leads are even reachable — cheap unreachable leads are worthless. |
| **Close rate** | `ghl_won_opps / ghl_total_opps` | The back half of the funnel; contextualizes CPL. |
| **Custom metrics** | user-defined formula parts | The app supports custom formula metrics (`custom:<id>`) built from any of the above; treat them as first-class and use their given name. |

## Reading the metrics together

No metric means anything alone. The value is in the ratios and the movement:

- **High CPL** → decompose: is it CPM (impression cost), CTR (creative), post-click conversion, or
  downstream quality? Each points to a different level and fix (see the diagnostic chain in SKILL.md).
- **Great CPL + low ROAS** → a zombie-lead / quality problem. The classic trap. Follow the funnel.
- **Rising frequency + rising CPM + falling CTR** → fatigue. Refresh creative before cutting budget.
- **High CTR + high CPL** → post-click problem (landing/offer/form), not the ad.
- **Low connect rate on one ad's leads** → that audience/form is producing unreachable or low-intent
  leads; fix the ad set or the lead form, not the call center.
- **Cheap leads, no opportunities** → the offer is attracting the wrong people; CPL is lying to you.
