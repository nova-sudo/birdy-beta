# Extending this skill

This skill is built as a **router + plug-in modules** so it can grow without rewrites. Read this
before adding anything — it's the contract that keeps additions consistent (whether a human or Claude
makes them).

## The architecture in one picture

```
SKILL.md                    ← thin ROUTER: universal reasoning + the Capability Registry (the wiring)
├── references/
│   ├── _extending.md        ← this contract
│   ├── metrics-glossary.md  ← cross-source derived metrics + how to read them together
│   ├── sources/*.md         ← one file per data system      (AXIS 1: platforms / integrations)
│   ├── playbooks/*.md       ← one file per analysis method   (AXIS 2: analyses)
│   └── templates/*.md       ← one file per deliverable       (AXIS 3: outputs)
└── scripts/*                ← deterministic tools            (AXIS 4: computation/fetch)
```

**The rule:** universal reasoning (mental models, diagnostic chain, scale/kill/optimize, rigor rules)
stays in SKILL.md and rarely changes. Everything *specific* is a module discovered through the
**Capability Registry** in SKILL.md. Adding an ability = create a module + add one registry row. You
should almost never need to rewrite existing files to add a new capability.

## The four axes — pick where your ability belongs

| You want to add… | Axis | Put it in | Example |
|------------------|------|-----------|---------|
| A new ad platform or data system | **Source** | `references/sources/<name>.md` | Google Ads, TikTok Ads, a new CRM |
| A new way to analyze | **Playbook** | `references/playbooks/<name>.md` | creative analysis, forecasting, anomaly/alert, competitor benchmark, A/B readout |
| A new output format | **Template** | `references/templates/<name>.md` | weekly pacing email, QBR deck outline, Slack digest |
| A deterministic computation or fetch | **Script** | `scripts/<name>.<ext>` | ROAS table builder, data puller, fatigue scanner |

If an ability spans axes (common), add each piece to its axis and cross-link them. E.g. "TikTok
support" = a `sources/tiktok.md` **plus** maybe a note in the relevant playbooks; "forecasting" = a
`playbooks/forecasting.md` **plus** perhaps a `scripts/forecast.py`.

## The registration checklist (do all of these)

1. **Create the module** following the matching stub below. Keep it self-contained: state when to use
   it at the top, then the method/content. Cross-link sibling modules by path.
2. **Register it** — add a row to the correct table in SKILL.md's **Capability registry** with a
   one-line "reach for it when" and the `path`. This is what makes the skill *find* your ability.
3. **Keep triggering in sync** — if the ability makes the skill relevant to prompts it wasn't before,
   add those phrasings to the `description` in SKILL.md's frontmatter. Modules are invisible to the
   trigger decision; only the description fires the skill. (A new *template* usually needs no
   description change; a new *source* or a new *analysis type* usually does.)
4. **Add an eval** — at least one realistic prompt in `evals/evals.json` that exercises the ability,
   so you can confirm it works and doesn't regress the others.
5. **Validate** — run `python scripts/validate_skill.py` to check every registry row points to a real
   file and every module is registered.

## Module stubs

**Source** (`references/sources/<name>.md`):
```markdown
# Source: <Name>
**Role in the funnel:** <where it sits — buying surface / CRM / call center / …>
## Metrics (this source owns these)
| id | Name | Definition | Diagnoses | Benchmark |
## Object shape / key fields
## Endpoints
## How it plugs into analysis   <!-- how its metrics join the funnel; link metrics-glossary.md -->
```

**Playbook** (`references/playbooks/<name>.md`):
```markdown
# Playbook: <Name>
**Reach for it when:** <the trigger situation>
## Method            <!-- the reasoning steps, not a rigid script -->
## Worked example    <!-- optional but valuable: data in → read → call -->
```

**Template** (`references/templates/<name>.md`):
```markdown
# Template: <Name>
**Use when the ask is:** <the request this format answers>
​```markdown
<the actual output skeleton with {placeholders}>
​```
<any rules: what to omit when data is missing, tone, etc.>
```

**Script** — see `scripts/README.md` for the convention (standalone, documented, no surprise network).

## Worked example — adding Google Ads (a Source)

1. Create `references/sources/google-ads.md` from the Source stub: its metric names (many map to Meta
   concepts — cost, impressions, CTR, conversions, CPA — but the vocabulary differs), its hierarchy
   (Campaign → Ad Group → Ad), its endpoints, and how it joins the same GHL/HotProspector funnel.
2. Add a row under **Sources** in SKILL.md's registry: `Google Ads | Search/PMax buying surface | references/sources/google-ads.md`.
3. Update the frontmatter `description` to mention Google Ads / search alongside Meta, so the skill
   triggers on Google-Ads prompts.
4. Add an eval prompt that hands the skill Google Ads data.
5. `python scripts/validate_skill.py`.

The universal reasoning (funnel, diagnostic chain, scale/kill/optimize) already applies — you're only
teaching the skill a new vocabulary and where the data lives, not a new way to think.

## Worked example — adding a "creative analysis" Playbook

1. Create `references/playbooks/creative-analysis.md`: how to compare creatives on hook rate
   (3-sec/thumb-stop), hold, CTR, and downstream quality; how to spot winning angles/formats; when to
   iterate vs. retire. Cross-link `fatigue.md` and `isolating-cause.md`.
2. Register it under **Analyses**.
3. Add "analyze/compare creatives, which ad creative/angle is working" phrasings to the description.
4. Add an eval. Validate.

## Anti-patterns (don't)

- **Don't fatten SKILL.md** with ability-specific detail — that's what modules are for. SKILL.md holds
  only universal reasoning + the registry.
- **Don't duplicate** a metric definition across files — a source owns its metrics; derived metrics
  live in `metrics-glossary.md`; link, don't copy.
- **Don't add a module without registering it** — an unregistered module is invisible; the registry is
  the discovery mechanism.
- **Don't forget the description** — a perfectly written module that the description never advertises
  won't trigger.
