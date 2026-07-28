# Metrics Glossary — cross-source & derived

Per-source metric dictionaries live with their source module (`references/sources/meta.md`,
`gohighlevel.md`, `hotprospector.md`) so each platform carries its own vocabulary. This file holds
the metrics that span sources: the **derived / true-north** metrics you compute, and the rules for
**reading metrics together**. Benchmarks anywhere in this skill are directional — the client's own
target and history are the real benchmark.

## Derived / true-north metrics

Not always columns in the data — you compute these by joining sources. They're what the client
actually pays for, so reframe raw CPL into them whenever the data allows.

| Metric | Formula | Why it beats raw CPL |
|--------|---------|----------------------|
| **ROAS** | `ghl_revenue / spend` | The only metric that says whether the ad made money. A profitable ad at a "high" CPL beats a cheap ad that never closes. |
| **Cost per qualified lead** | `spend / (leads that became opportunities)` | Strips out zombies and junk leads. |
| **Cost per booked call / appointment** | `spend / appointments` | Ties spend to a real sales event. |
| **Cost per won opp (CPA)** | `spend / ghl_won_opps` | Cost of actual closed business. |
| **Lead→opp rate** | `ghl_total_opps / leads` | Quality of the lead at the top of the funnel. |
| **Close rate** | `ghl_won_opps / ghl_total_opps` | The back half of the funnel; contextualizes CPL. |
| **Connect rate** | `hp_connect_rate` | Whether leads are even reachable — cheap unreachable leads are worthless. |
| **Custom metrics** | user-defined formula parts | The app supports custom formula metrics (`custom:<id>`) built from any base metric; treat them as first-class and use their given name. |

## Reading the metrics together

No metric means anything alone. The value is in the ratios and the movement:

- **High CPL** → decompose: CPM (impression cost), CTR (creative), post-click conversion, or
  downstream quality? Each points to a different level and fix (see the diagnostic chain in SKILL.md
  and `references/playbooks/isolating-cause.md`).
- **Great CPL + low ROAS** → a zombie-lead / quality problem. The classic trap.
  → `references/playbooks/lead-quality.md`.
- **Rising frequency + rising CPM + falling CTR** → fatigue. Refresh creative before cutting budget.
  → `references/playbooks/fatigue.md`.
- **High CTR + high CPL** → post-click problem (landing/offer/form), not the ad.
- **Low connect rate on one ad's leads** → that audience/form produces unreachable or low-intent
  leads; fix the ad set, not the call center (unless the leads simply weren't called — an ops issue).
- **Cheap leads, no opportunities** → the offer is attracting the wrong people; CPL is lying.

## The funnel these metrics live on

```
Impression → Click → Landing/Form → Meta Lead → GHL Contact → Opportunity → Call (HP) → Appointment → Won Opp → Revenue
    CPM        CTR      conv. rate     CPL         matched?      status/value   connect?     booked?      closed?    ROAS
```

Every stage has a metric and a failure mode. High CPL can be born at any stage — the analysis is
finding *which* one, because that determines the fix.
