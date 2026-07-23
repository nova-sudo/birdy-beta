# Playbook: Isolating the cause

**Reach for it when:** a metric looks bad (usually high CPL) and you need the *why* before you
prescribe. The same symptom has four different homes, each with a different fix.

```
CPL high?
├─ CPM high?            → impression cost   → AD SET (audience too narrow / competition) or AD (quality ranking)
├─ CTR low?            → creative/offer    → AD (new hook, format, angle)
├─ CTR ok, LP conv low? → post-click        → landing page / form / offer (not the ad)
└─ upstream ok, no closes? → lead quality   → AD SET (audience) / offer — see lead-quality.md
```

## Isolation technique

- **Hold audience, vary creative.** Within one ad set, ads share the audience — so CTR/CPM
  differences between them are *creative* effects. The best creative is high CTR **and** healthy CPL,
  not just high CTR.
- **Hold creative, vary audience.** The same ad across ad sets isolates *audience* effects — CPM and
  downstream quality differences are the audience talking.
- **CPC decomposition.** `CPC ≈ CPM / (CTR × 10)`. High CPC with normal CPM ⇒ creative (CTR) problem;
  with normal CTR ⇒ audience/auction (CPM) problem.

## Worked example — high CTR, high CPL

> Ad E: CTR 2.4% (great), CPL $38 (bad), CPM in line with the account.
> **Read:** the hook works (CTR) and impressions aren't overpriced (CPM) — the leak is post-click.
> **Call:** OPTIMIZE the landing page / form / offer, not the creative. Check LP speed and message
> match against the ad's promise before spending another dollar scaling it.
