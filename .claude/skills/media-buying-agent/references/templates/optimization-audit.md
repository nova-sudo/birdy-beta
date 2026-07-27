# Template: Optimization audit

**Use when the ask is:** "what do I scale / kill / fix." The core media-buyer deliverable — internal,
decision-first. The reader is a buyer who wants to know what to do before lunch.

```markdown
# Optimization Audit — {Client} · {date window} · {currency}

## Verdict
{One or two sentences: winning, holding, or bleeding, and the single most important move.}
Blended: {spend} spend · {leads} leads · {CPL} CPL{ · {ROAS}× ROAS if available},
vs target {target CPL} and {prior period}.

## Priority actions
| # | Object (level) | Call | Why (metric vs target) | Move |
|---|----------------|------|------------------------|------|
| 1 | {Ad set X}     | KILL | $47 CPL on $780, 0 opps | Pause; redeploy to #3 |
| 2 | {Ad Y}         | OPTIMIZE | CTR 2.4% but CPL $38 | Fix landing/offer, then retest |
| 3 | {Ad set Z}     | SCALE | $12 CPL, ROAS 9×, freq 1.7 | +25% budget, re-check in 3–4 days |
{Ordered by spend impact. Every row: object, call, reason tied to a target, concrete move.}

## What's working
{Winners worth protecting — quality winners, not just low-CPL rows. Weight by spend.}

## What's wasting spend
{Bleeders and zombie factories, with the $ at stake so the size of the problem is clear.}

## Watch list
{Objects without enough data to judge yet, and the threshold you're waiting for.}

## Assumptions & gaps
{Window, missing revenue/call data, currency, confounders (seasonality/attribution).}
```

If the user asked you to **draft exact changes**, add a block of concrete moves: target budgets, and
the `{ object_type, object_id, status }` triples to pause — with a reminder that a human approves,
because this moves real spend.
