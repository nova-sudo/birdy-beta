# Slack report copilot — design

Date: 2026-10-13. Sub-project 1 of 2 (sub-project 2: a hand editor for the template in Settings).

## Goal
After a user connects Slack and picks a channel in onboarding, the page turns into a chat.
Birdy interviews them and designs their daily or weekly Slack report with them, showing a live
preview built from their real numbers. The result is a structured template that a deterministic
renderer fills at send time.

## Template (users.integrations.slack_bot.brief, version 2)
```
{version: 2, frequency: daily|weekly, day, time, title?,
 sections: [
   {type: metric, metric, scope: "portfolio" | {client_id}, compare: none|previous|target},
   {type: ranking, metric, direction: best|worst, limit: 1-5},
   {type: alerts}, {type: underperforming_ads},
   {type: birdy_take, focus?}         # at most one, always rendered last
 ]}
```
- Max 12 sections. Metrics come from a curated catalog over the metric registry. Clients must be the user's own.
- Legacy six-checkbox briefs are converted on read; there is one renderer.
- A schedule-only update (Settings) keeps the sections.

## Figures
- daily = yesterday, weekly = last 7 days (the cached presets). CRM and call-centre metrics only count
  clients whose cache actually holds that window (never the lifetime fallback).
- compare=target: client monthly targets. Ratio metrics compare directly; totals are pro-rated to the window.
  Portfolio scope sums totals' targets and skips ratio targets.
- compare=previous: each send stores its figures; the next send compares only if the stored figures
  are from the immediately previous period. First brief has no comparison.
- birdy_take: one model call fed only the rendered lines, ~60 words, metered as credits.
  Skipped silently on failure or no credits; the brief still sends.

## Copilot
- Reuses /api/chat with page="report_designer": own system prompt and tool allowlist
  (list_report_clients, list_report_metrics, get_report_draft, propose_report).
- propose_report validates and stores a per-user draft (report_drafts). The UI re-fetches the
  draft and preview after each reply.
- Questions use the existing :::ui radio/checkbox blocks.
- Credits gate is skipped for this page while onboarding is incomplete.

## Endpoints
- GET  /api/report-designer/state     → current brief, draft, catalog
- PUT  /api/report-designer/draft     → seed/reset the draft
- POST /api/report-designer/preview   → render a template with real data (blocks + text)
- PUT  /api/integrations/slack/brief  → also accepts {template}

## UI
- Onboarding: slack_frequency + brief_content are replaced by one `report_copilot` step: chat on the left,
  live Slack preview on the right, "Use this report" saves and continues. Skip keeps a sensible default.
- Settings: brief card shows the live preview and a "Redesign with Birdy" button opening the same
  copilot in a modal. Schedule controls stay.
