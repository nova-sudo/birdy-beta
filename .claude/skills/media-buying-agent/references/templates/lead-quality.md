# Template: Lead-quality analysis

**Use when the ask is:** lead quality, zombies, ROAS, or "which ads actually make money." The
differentiated deliverable — judging ads on outcomes, not clicks. Pairs with
`references/playbooks/lead-quality.md`.

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
{Low-CPL ads whose leads don't match, connect, or progress — with spend at risk and likely cause
(broad audience? instant form? wrong offer?).}

## Hidden winners
{"Expensive" ads that actually close and generate revenue — protect and scale these.}

## Recommended moves
{Per problem ad: fix the audience/form/offer, or kill and redeploy. Tie each to the funnel evidence.}

## Operations vs media note
{If low connect rates trace to leads not being called at all (low `hp_leads_with_calls`), flag it as
a call-center/ops issue — not media — so the right team owns the fix.}
```
