# Source: GoHighLevel (GHL)

**Role in the funnel:** the CRM / outcome layer — where a Meta lead becomes (or fails to become)
pipeline and money. This is the numerator of ROAS. Linked to a client via `ghl_location_id`.

## Metrics (this source owns these)

| id | Name | Definition | Diagnoses |
|----|------|------------|-----------|
| `ghl_leads` / `ghl_contacts` | GHL Leads / Contacts | Contacts in GHL | Did Meta leads land in the CRM? |
| `ghl_total_opps` | Total Opps | Opportunities created | How many leads became real pipeline |
| `ghl_won_opps` | Won Opps | Opportunities won | Closed business |
| `ghl_lost_opps` | Lost Opps | Opportunities lost | Disqualification / loss rate |
| `ghl_open_opps` | Open Opps | Still in pipeline | Live pipeline yet to resolve |
| `ghl_abandoned_opps` | Abandoned Opps | Abandoned | Follow-up failure / dead pipeline (zombie signal) |
| `ghl_revenue` | GHL Revenue | Revenue booked | **Top line for ROAS** |
| `ghl_conversion` | GHL Conversion (%) | Lead → won | True close rate behind the ads |
| `ghl_opportunity_status` | Opp Status | open / won / lost / abandoned (per lead) | Where each lead sits |
| `ghl_opportunity_value` | Opp Value | $ value (per lead) | Lead value, for value-weighting |
| `ghl_matched` | GHL Match | Meta lead matched a GHL contact? | **Attribution integrity** — unmatched leads can't be scored on outcome |
| `ghl_tags` | Tags | Tags on the contact | Segmentation / qualification |
| `ghl_pipeline_stage` | Pipeline Stage | Stage in pipeline | Funnel progression |
| `ghl_date_added` | Date Added | When it entered GHL | Speed-to-CRM, cohorting |
| `source` | Source | Lead source | Channel attribution in GHL |

## Opportunity statuses

`open` (live), `won` (closed business), `lost` (disqualified/declined), `abandoned` (went cold /
follow-up failed). A pile of `open` opportunities that never move, or many `abandoned`, is a
**zombie-lead** signal — surface it against the ad that produced them.

## Endpoints

| Endpoint | Returns | Use for |
|----------|---------|---------|
| `GET /api/campaigns/opp-rollup?groups=&start_date=&end_date=` | GHL opps/revenue **per campaign** | Joining Meta campaigns to outcomes (ROAS, won opps) |
| `GET /api/campaigns/tag-rollup?groups=` | GHL tag counts per campaign | Tag-based qualification analysis |
| `GET /api/leads/unified` · `GET /api/leads/filter-options` | Unified lead list + filters | Cross-source lead views |

## How it plugs into analysis

GHL is what turns "cheap CPL" into "did it make money." Always pull opportunity status/value and
revenue before declaring an ad a winner. `ghl_matched = false` means you *cannot* judge that lead on
outcome — call that out rather than assuming it failed. Derived true-north metrics that lean on GHL
(ROAS, cost per won opp, lead→opp rate) live in `references/metrics-glossary.md`.
