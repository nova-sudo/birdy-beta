# Playbook: Lead-quality & zombie-lead analysis

**Reach for it when:** the ask is about lead quality, zombies, ROAS, or "which ads actually make
money." This is the stack's superpower — never let CPL be the last word when GHL/HP data exists.

## Method

Group leads by `ad_name` (or `adset_name`) and, for each, assemble the funnel:

```
leads → ghl_matched % → became opportunity % → connect rate (HP) → appointments → won opps → revenue
```

Then classify each ad:

- **Quality winner** — decent CPL *and* leads convert: high match rate, opportunities progressing,
  good connect rate, real revenue. Scale these even if their CPL isn't the lowest.
- **Zombie factory** — low CPL, high lead count, but leads stall: low `ghl_matched`, opportunities
  stuck open/abandoned, low `hp_connect_rate`, no revenue. The cheap CPL is a mirage. Kill or fix the
  audience/offer/form.
- **Expensive but golden** — high CPL, but high close rate and value ⇒ profitable. Protect it; never
  kill on CPL alone.

## Diagnosing zombies

Low connect rate on one ad's leads points at the *lead* (bad numbers, low intent, an instant-form
harvesting junk) — fix the ad set / form. **But first check `hp_leads_with_calls`:** if leads simply
weren't called, that's an **operations** problem, not media — say so plainly (see
`references/sources/hotprospector.md`).

**Instant forms vs. conversion leads:** Meta instant/lead forms produce more, cheaper, lower-intent
leads; conversion-optimized landing pages produce fewer, pricier, higher-intent leads. If an ad set's
CPL looks too good and quality is poor, the form type is a prime suspect.

## Worked examples

**"Great CPL" that's actually a zombie factory**
> Ad A: $6.10 CPL, 128 leads, $780 spend — lowest CPL in the account. Funnel: 41% matched, 12 opps
> (all open), 19% connect, $0 revenue.
> **Read:** the cheap CPL is a mirage — unreachable, non-progressing leads; likely instant-form +
> broad audience. **Call:** OPTIMIZE (switch to conversion-lead optimization / qualified form,
> retest); if quality doesn't move, KILL and redeploy. Don't scale it on CPL.

**"Expensive" ad that's the real winner**
> Ad C: $22 CPL, 30 leads, $660 spend — near the top of the CPL range. Funnel: 90% matched, 21 opps,
> 6 won, $9,400 revenue ⇒ ROAS ≈ 14×, connect 63%.
> **Read:** highest CPL, best *business* — CPL was lying, ROAS tells the truth. **Call:** SCALE (+25%,
> hold audience, re-check in 3–4 days); protect this creative → `scaling.md`.
