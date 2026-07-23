# Media Buying Playbook

Deeper methods for the analyses that go past a one-line answer. Each playbook is a way of
*reasoning*, not a script to paste. Adapt to the data you actually have, and always weight by spend
and anchor to the client's target.

Contents:
- [1. Account triage — the 10-minute health read](#1-account-triage)
- [2. Isolating the cause: audience vs. creative vs. landing](#2-isolating-the-cause)
- [3. Ad fatigue detection](#3-ad-fatigue-detection)
- [4. Lead-quality & zombie-lead analysis](#4-lead-quality--zombie-lead-analysis)
- [5. Scaling without breaking CPL](#5-scaling-without-breaking-cpl)
- [6. Budget reallocation math](#6-budget-reallocation-math)
- [7. Worked examples](#7-worked-examples)

---

## 1. Account triage

Before drilling in, get the shape of the account in a few moves:

1. **Top line vs. target.** Total spend, total leads, blended CPL, and (if available) revenue/ROAS
   for the window — against the client's target and the prior period. One sentence: is this account
   winning, holding, or bleeding?
2. **Concentration.** What share of spend sits in the top 3 campaigns / ad sets? Winners starved and
   losers fat is the most common fixable problem.
3. **Dispersion.** Min/median/max CPL across ad sets. A tight band is a stable account; a wide band
   means big reallocation wins are available.
4. **Fatigue scan.** Any high-spend ad sets with frequency climbing past ~2.5–3? Flag for section 3.
5. **Quality flag.** If GHL/HP data exists, does blended ROAS or connect rate contradict the CPL
   story? If yes, the real analysis is section 4.

Output of triage is a *prioritized* list of where to look, not a verdict on every row.

## 2. Isolating the cause

The same symptom (high CPL) has four different homes. Decompose before prescribing:

```
CPL high?
├─ CPM high?          → impression cost   → AD SET (audience too narrow / competition) or AD (quality ranking)
├─ CTR low?           → creative/offer    → AD (new hook, format, angle)
├─ CTR ok, LP conv low? → post-click      → landing page / form / offer (not the ad)
└─ all upstream ok, no closes? → quality  → AD SET (audience) / offer — see section 4
```

Practical isolation:

- **Hold audience, vary creative.** Within one ad set, ads share the audience — so CTR/CPM
  differences between them are *creative* effects. The best creative is high CTR **and** healthy CPL,
  not just high CTR.
- **Hold creative, vary audience.** The same ad across ad sets isolates *audience* effects — CPM and
  downstream quality differences are the audience talking.
- **CPC decomposition.** `CPC ≈ CPM / (CTR × 10)`. A high CPC with normal CPM ⇒ creative (CTR) problem;
  with normal CTR ⇒ audience/auction (CPM) problem.

## 3. Ad fatigue detection

Fatigue is a *trend*, not a snapshot. The signature, over time on a stable audience:

- **Frequency rising** (people seeing the ad too often),
- **CTR falling** (they've tuned it out),
- **CPM/CPL rising** (Meta charges more as engagement drops).

When you can see a time trend and all three move that way on a high-spend object, call it fatigue and
prescribe a **creative refresh** (new hook/format/angle), not just a budget cut — cutting budget on a
fatigued winner just hides a fixable asset. On a small/narrow audience, fatigue arrives faster
(frequency climbs quickly); broadening the audience buys runway. If you only have a snapshot, a high
frequency (>3) with a soft CTR is a *fatigue suspicion* — say so, and ask for the trend.

## 4. Lead-quality & zombie-lead analysis

The stack's superpower. Never let CPL be the last word when GHL/HP data exists.

**Method:** group leads by `ad_name` (or `adset_name`) and, for each, assemble the funnel:

```
leads → ghl_matched %  → became opportunity %  → connect rate (HP) → appointments → won opps → revenue
```

Then classify each ad:

- **Quality winner** — decent CPL *and* leads convert: high match rate, opportunities progressing,
  good connect rate, real revenue. Scale these even if their CPL isn't the lowest.
- **Zombie factory** — low CPL, high lead count, but leads stall: low `ghl_matched`, opportunities
  stuck open/abandoned, low `hp_connect_rate`, no revenue. The cheap CPL is a mirage. Kill or fix the
  audience/offer/form even though the surface metric looks great.
- **Expensive but golden** — high CPL, but high close rate and value ⇒ profitable. Protect it; don't
  kill on CPL alone.

**Diagnosing zombies:** low connect rate on one ad's leads points at the *lead* (bad numbers, low
intent, an instant-form that harvests junk) — fix the ad set/form, not the call center. But first
check `hp_leads_with_calls`: if leads simply weren't called, that's an **operations** problem, not a
media problem — say so plainly instead of blaming the ad. Use per-agent stats
(`/api/hotprospector/members/dashboard`) to tell these apart.

**Instant forms vs. conversion leads:** Meta instant/lead forms produce more, cheaper, lower-intent
leads; conversion-optimized landing pages produce fewer, pricier, higher-intent leads. If an ad set's
CPL looks too good and quality is poor, the form type is a prime suspect.

## 5. Scaling without breaking CPL

Scaling is where good accounts get wrecked. Principles:

- **Scale the ad set/campaign, not the ad.** Budget lives at the ad set (ABO) or campaign (CBO).
- **~20–30% budget increases, then let it settle** (a few days). Big jumps re-trigger the learning
  phase and spike CPL.
- **Scale into headroom, not into a wall.** A winner with rising frequency has little audience left —
  scaling it just accelerates fatigue. Broaden the audience or duplicate into a new one instead.
- **Horizontal > vertical when tapped out.** New audiences/creatives (horizontal) often beat forcing
  more budget through a saturating ad set (vertical).
- **Protect the learning.** Note CBO vs ABO: under CBO the campaign reallocates for you, so starving a
  good ad set by hard-capping budgets fights the algorithm.

## 6. Budget reallocation math

The highest-leverage, lowest-risk move is usually shifting budget from losers to proven winners.
Quantify it so the recommendation is concrete:

1. Identify ad sets consistently **below** target CPL with quality + headroom (scale candidates) and
   those consistently **above** with no fixable cause (cut candidates).
2. Estimate the reclaim: budget currently on cut candidates that's producing above-target or zombie
   leads.
3. Redeploy in ~20–30% steps to scale candidates, and project the effect *conservatively* — assume
   some CPL creep as you scale (winners rarely hold their exact CPL at 2× budget). Frame it as "shift
   ~$X/day from A,B into C,D; expect roughly N more leads at roughly $Y CPL, re-check in 3–4 days,"
   never a false-precision guarantee.
4. State the assumptions (held CPL, no fatigue, same close rate). Reallocation projections are
   directional.

## 7. Worked examples

**Example — "great CPL" that's actually a zombie factory**
> Ad A: $6.10 CPL, 128 leads, $780 spend — the lowest CPL in the account.
> Funnel: only 41% `ghl_matched`, 12 opportunities (all still open), HP connect rate 19%, $0 revenue.
> **Read:** the cheap CPL is a mirage — these leads aren't reachable and don't progress. Likely an
> instant-form + broad-audience combo harvesting low-intent leads.
> **Call:** OPTIMIZE — switch this ad set to conversion-lead optimization or a qualified form, and
> retest; if quality doesn't move, KILL and redeploy to Ad C. Don't scale it on CPL.

**Example — "expensive" ad that's the real winner**
> Ad C: $22 CPL, 30 leads, $660 spend — near the top of the CPL range.
> Funnel: 90% matched, 21 opportunities, 6 won, $9,400 revenue ⇒ ROAS ≈ 14×, connect rate 63%.
> **Read:** highest CPL, best *business*. CPL was lying; ROAS tells the truth.
> **Call:** SCALE — +25% budget, hold the audience, re-check in 3–4 days; protect this creative.

**Example — high CTR, high CPL**
> Ad E: CTR 2.4% (great), CPL $38 (bad), CPM in line with the account.
> **Read:** the hook works (CTR) and impressions aren't overpriced (CPM) — the leak is post-click.
> **Call:** OPTIMIZE the landing page/form/offer, not the creative. Check LP speed and message match
> against the ad's promise before spending another dollar scaling it.

**Example — fatigue**
> Ad set G over 14 days: frequency 1.8 → 3.6, CTR 1.9% → 0.7%, CPL $14 → $31, spend steady.
> **Read:** textbook fatigue — same audience, seen too often, tuning out, Meta charging more.
> **Call:** refresh creative (new angle/format) and/or broaden the audience; don't just cut budget on
> what was a winner.
