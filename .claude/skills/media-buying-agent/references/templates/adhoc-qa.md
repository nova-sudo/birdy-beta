# Template: Ad-hoc Q&A

**Use when the ask is:** a specific metric question ("which ad has the best CTR?", "worst CPL ad sets
last week?", "most zombie leads?"). Answer directly, then add the *so-what* — a raw ranking without
judgment is half an answer.

```markdown
**{Direct answer.}** {e.g., "Ad 'Spring-Promo-V3' has the best CTR at 3.1%."}

{Supporting rows — the top few, weighted by spend, with the relevant metric:}
- {Object} — {metric}{, plus a context column, e.g. spend or CPL}

**So what:** {the judgment — is the CTR winner also converting, or a vanity number? Is the worst-CPL
ad set worth killing or just under-data? One or two sentences that turn the fact into a decision.}
```

Guardrails even on quick answers: weight by spend (don't crown a $9-spend row), require data before
declaring a winner/loser, and note if the answer flips once you account for quality (a best-CTR ad
with a terrible CPL isn't really "the best ad").
