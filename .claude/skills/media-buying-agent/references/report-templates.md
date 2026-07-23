# Report Templates

Pick the template that matches what the user asked for. These are structures, not scripts — keep the
shape, drop sections that don't apply, and never pad with numbers you can't back up. Every deliverable
leads with the **decision or the answer**, then the evidence. Format money in the client's
`account_currency`, and flag any window or data caveats up front.

Templates:
- [A. Optimization audit](#a-optimization-audit) — the core media-buyer deliverable
- [B. Client-facing report](#b-client-facing-report) — written for the client
- [C. Ad-hoc Q&A](#c-ad-hoc-qa) — fast, specific answers
- [D. Lead-quality analysis](#d-lead-quality-analysis) — past the click

---

## A. Optimization audit

Internal, decision-first. The reader is a buyer who wants to know what to do before lunch.

```markdown
# Optimization Audit — {Client} · {date window} · {currency}

## Verdict
{One or two sentences: is the account winning, holding, or bleeding, and the single most
important move.} Blended: {spend} spend · {leads} leads · {CPL} CPL{ · {ROAS}× ROAS if available},
vs target {target CPL} and {prior period}.

## Priority actions
| # | Object (level) | Call | Why (metric vs target) | Move |
|---|----------------|------|------------------------|------|
| 1 | {Ad set X}     | KILL | $47 CPL on $780, 0 opps | Pause; redeploy budget to #3 |
| 2 | {Ad Y}         | OPTIMIZE | CTR 2.4% but CPL $38 | Fix landing/offer, then retest |
| 3 | {Ad set Z}     | SCALE | $12 CPL, ROAS 9×, freq 1.7 | +25% budget, re-check in 3–4 days |
{Ordered by spend impact. Every row: object, call, reason tied to a target, concrete move.}

## What's working
{Winners worth protecting — the quality winners, not just the low-CPL rows. Weight by spend.}

## What's wasting spend
{The bleeders and zombie factories, with the $ at stake so the size of the problem is clear.}

## Watch list
{Objects without enough data to judge yet, and the threshold you're waiting for.}

## Assumptions & gaps
{Window, missing revenue/call data, currency, any confounders (seasonality/attribution).}
```

If the user asked you to **draft exact changes**, add a block of concrete moves: target budgets, and
the `{ object_type, object_id, status }` triples to pause — with a reminder that a human approves,
because this moves real spend.

## B. Client-facing report

For the client, not the buyer. Plain language, outcome-focused, no jargon-dumping. Lead with results
and money; keep the diagnostics light and the next steps confident.

```markdown
# {Client} — Performance Summary · {date window}

## Headline
{The result in one line: leads, cost per lead, and — if you have it — booked calls / revenue /
return. Compare to last period in plain terms ("down 18% from last month").}

## The numbers that matter
- **Spend:** {spend}
- **Leads:** {leads}  ({+/- vs prior})
- **Cost per lead:** {CPL}  ({+/- vs prior})
- **Opportunities / booked:** {ghl opps / appointments}
- **Revenue / return:** {ghl_revenue / ROAS}   ← include only if data exists

## What went well
{2–4 concrete wins in outcome terms — "the {campaign} brought in {N} leads at {CPL}, {X} booked".}

## What we're improving
{1–3 issues, framed as actions already in motion, not blame. No raw metric soup.}

## Next steps
{What you'll do next window — scale the winners, fix/replace the laggards, test new angles.}
```

Rule: if you don't have revenue/call data, don't imply outcomes you can't see. Say the report is
lead-and-cost based this period.

## C. Ad-hoc Q&A

Someone asked a specific question ("which ad has the best CTR?", "worst CPL ad sets last week?",
"most zombie leads?"). Answer it directly, then add the *so-what* — a raw ranking without judgment is
half an answer.

```markdown
**{Direct answer.}** {e.g., "Ad 'Spring-Promo-V3' has the best CTR at 3.1%."}

{Supporting rows — the top few, weighted by spend, with the relevant metric:}
- {Object} — {metric}{, and a second column for context, e.g. spend or CPL}

**So what:** {the judgment — is the CTR winner also converting, or a vanity number? Is the worst-CPL
ad set worth killing or just under-data? One or two sentences that turn the fact into a decision.}
```

Guardrails even on quick answers: weight by spend (don't crown a $9-spend row), require data before
declaring a winner/loser, and note if the answer flips once you account for quality (a best-CTR ad
with a terrible CPL isn't really "the best ad").

## D. Lead-quality analysis

The differentiated deliverable — judging ads on outcomes, not clicks. Use when the ask is about lead
quality, zombies, ROAS, or "which ads actually make money".

```markdown
# Lead-Quality Analysis — {Client} · {date window}

## Bottom line
{Which ads/ad sets bring GOOD leads vs cheap-but-dead ones, and the money implication.}

## The funnel by ad
| Ad / Ad set | Leads | CPL | Matched % | Opps (won) | Connect rate | Revenue | ROAS | Verdict |
|-------------|-------|-----|-----------|-----------|--------------|---------|------|---------|
| {Ad C}      | 30    | $22 | 90%       | 21 (6)    | 63%          | $9,400  | 14×  | Quality winner — scale |
| {Ad A}      | 128   | $6  | 41%       | 12 (0)    | 19%          | $0      | 0×   | Zombie factory — fix/kill |
{Fill only the columns you have data for; leave the rest out rather than guessing.}

## Zombie factories
{Low-CPL ads whose leads don't match, don't connect, or don't progress — with the spend at risk and
the likely cause (broad audience? instant form? wrong offer?).}

## Hidden winners
{"Expensive" ads that actually close and generate revenue — protect and scale these.}

## Recommended moves
{Per problem ad: fix the audience/form/offer, or kill and redeploy. Tie each to the funnel evidence.}

## Operations vs media note
{If low connect rates trace to leads not being called at all (low `hp_leads_with_calls`), flag it as
a call-center/ops issue — not a media-buying one — so the right team owns the fix.}
```
