# Playbook: Account triage

**Reach for it when:** you're taking a first look at an account and need to know where to dig before
drilling into rows. Output is a *prioritized list of where to look*, not a verdict on every object.

Get the shape of the account in a few moves:

1. **Top line vs. target.** Total spend, leads, blended CPL, and (if available) revenue/ROAS for the
   window — against the client's target and the prior period. One sentence: winning, holding, or
   bleeding?
2. **Concentration.** What share of spend sits in the top 3 campaigns / ad sets? Winners starved and
   losers fat is the most common fixable problem.
3. **Dispersion.** Min/median/max CPL across ad sets. A tight band is a stable account; a wide band
   means big reallocation wins are available → `budget-reallocation.md`.
4. **Fatigue scan.** Any high-spend ad sets with frequency climbing past ~2.5–3? Flag for
   `fatigue.md`.
5. **Quality flag.** If GHL/HP data exists, does blended ROAS or connect rate contradict the CPL
   story? If yes, the real analysis is `lead-quality.md`.

Always weight by spend — a scary CPL on tiny spend is noise. End triage with 2–4 "look here next"
pointers ranked by dollars at stake.
