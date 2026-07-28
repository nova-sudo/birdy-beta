# Integrations — wiring this skill into the Birdy AI agent

`.claude/skills/` is consumed by **Claude Code / Claude**, not by the product's "Ask Birdy" agent.
Ask Birdy is a **backend** agent: the frontend (`src/components/chat/ChatConversation.jsx`) POSTs to
`/api/chat` with `{ message, session_id, page, client_group_id, client_name }`, and the brain
(system prompt, tools, model) lives in **`birdy-backend`** (a separate repo). So this skill can't
"activate" inside Birdy on its own — you port its *reasoning* into Birdy's prompt/tools, and keep this
skill as the single source of truth for that reasoning.

## What Birdy already has vs. what the skill adds

Birdy already ships the **data tools** (from `src/lib/chat-tool-icons.js`): `get_campaign_insights`,
`get_adset_insights`, `get_ad_insights`, `get_facebook_leads`, `get_unified_leads`,
`get_unified_lead_stats`, `get_ghl_opportunity_stats`, `get_ghl_tag_breakdown`,
`get_tag_rollup_by_campaign`, `get_account_summary`, `compare_periods`, `list_custom_metrics`,
`compute_custom_metric`, `get_alerts`, … It can *fetch*. What it lacks is the **media-buyer reasoning**
that turns those numbers into decisions. That reasoning is this skill. You're adding a brain, not
plumbing.

> **Data gap to note:** Birdy's current toolset is Meta + GHL. There is no HotProspector/call-center
> tool yet, so the agent can follow the funnel Meta → GHL (match, opportunities, revenue) but not
> Meta → HotProspector (connect rate, appointments). Add a `get_call_center_stats` tool to unlock the
> full lead-quality analysis — see "Extending" below.

## The hook: `page`-scoped system prompt + tools

`ChatConversation` passes `page` (a slug) and the backend uses it to scope the system prompt and the
available tools. That is the clean insertion point: for `page` values on the campaigns / ask-birdy
surfaces, prepend the media-buying system-prompt module and (optionally) register the reference-loader
tool.

## Recommended architecture (mirrors the skill's progressive disclosure)

1. **Base system prompt** — inject `birdy-agent-system-prompt.md` (this folder). It's the skill's
   router condensed for an always-on prompt: identity, the two mental models, the diagnostic chain,
   the scale/kill/optimize framework, the rigor rules, and a map from each analysis step to Birdy's
   real tool names. Keep it lean — it runs every turn (and often on the user's own AI credits).
2. **Reference-loader tool** — register `get_media_buying_playbook(module)` (see
   `reference-loader-tool.md`). It serves one `references/**` module on demand, so depth (full
   playbooks, templates, per-source detail) loads only when needed instead of bloating the base
   prompt. The tool's content source **is this skill** — ship `references/` with the backend and read
   from it, so there's one source of truth.
3. **Output templates** — when the user asks for an audit/report/Q&A/lead-quality write-up, the agent
   loads the matching `references/templates/*` module via the tool and follows it.

This keeps Birdy's base prompt small, reuses the exact modules the skill already defines, and means
improving the skill improves Birdy.

## Integration options, ranked

- **A. System prompt + reference-loader tool (recommended).** Best fit for a custom tool-calling agent
  with BYO credentials. Small base prompt, depth on demand. Steps above.
- **B. System prompt only (fastest).** Inline `birdy-agent-system-prompt.md` and skip the tool. Good
  for a v1; the agent reasons well from the router alone but won't have the deep playbooks/templates
  verbatim. Upgrade to A when you want consistent report formatting.
- **C. Full Agent-SDK skills (only if applicable).** If `birdy-backend` runs on the Claude Agent SDK
  with Agent Skills support, point it at this skill directory / a packaged `.skill` and it loads
  natively. Their agent looks custom (BYO keys, hand-rolled tools), so confirm before assuming this.

## To actually wire it

The code that assembles the per-`page` system prompt and registers tools is in **`birdy-backend`**,
which isn't in this session. Two ways forward:

- Add the `birdy-backend` repo to the session and I'll implement it there — page-scoped prompt
  injection + the `get_media_buying_playbook` tool + (optionally) a `get_call_center_stats` tool.
- Or take `birdy-agent-system-prompt.md` + `reference-loader-tool.md` from this folder and drop them
  into the backend yourselves.

## Keeping it in sync

Because the skill is the source of truth, treat `birdy-agent-system-prompt.md` as **generated from**
the skill's SKILL.md router. When you change the core reasoning in SKILL.md, regenerate this module so
Birdy and Claude Code stay aligned. The `references/**` modules are shared verbatim by the loader tool,
so those never need duplicating.
