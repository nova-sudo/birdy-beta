# Source: HotProspector

**Role in the funnel:** the call center — whether anyone actually *reached and worked* the lead. The
difference between a lead and a conversation. This is where cheap-but-unreachable leads get exposed.

## Metrics — per client, date-windowed (this source owns these)

| id | Name | Definition | Diagnoses |
|----|------|------------|-----------|
| `hp_leads` | Call Center Leads | Leads in HotProspector | Leads that reached the call center |
| `hp_total_calls` | Total Calls | All calls | Effort/volume |
| `hp_inbound` | Inbound Calls | From leads | Lead-initiated interest |
| `hp_outbound` | Outbound Calls | To leads | Follow-up effort |
| `hp_transfers` | Transfers | Calls transferred (e.g. to closer) | Hand-off / qualified signal |
| `hp_leads_with_calls` | Leads Called | Distinct leads with ≥1 call | **Coverage** — were leads worked at all? Low ⇒ zombie/ops risk |
| `hp_answered_calls` | Answered Calls | Answered | Reachability |
| `hp_talk_time` | Talk Time (min) | Total talk minutes | Depth of engagement |
| `hp_connect_rate` | Connect Rate (%) | Connected / attempted | **Lead reachability & phone-number quality** — a top quality signal |
| `hp_answer_rate` | Answer Rate (%) | Answered / placed | Reachability |

## Metrics — per agent, account-wide

`hp_agent_outbound`, `hp_agent_inbound`, `hp_agent_dialed`, `hp_agent_answered`, `hp_agent_convos`,
`hp_agent_appts` (appointments set), `hp_agent_talk_min`, `hp_agent_sms`, `hp_agent_answer_rate`.

## The media-vs-ops distinction (important)

A low connect rate can mean two very different things:
- **Leads were called but don't connect** (`hp_leads_with_calls` high, `hp_connect_rate` low) → a
  **lead-quality / media** problem: bad numbers, low intent, junk-harvesting form. Fix the ad set /
  audience / lead form.
- **Leads weren't called** (`hp_leads_with_calls` low) → a **call-center / operations** problem, not a
  media one. Say so — don't blame the ad for an ops gap.

Use per-agent stats (`/api/hotprospector/members/dashboard`) to tell these apart before assigning a
cause.

## Endpoints

| Endpoint | Returns | Use for |
|----------|---------|---------|
| `GET /api/hotprospector/call-center` | Call-center leads w/ embedded call logs | Connect rate, coverage, zombie detection |
| `GET /api/hotprospector/members/dashboard` | Per-agent call stats | Media-vs-ops diagnosis |

## How it plugs into analysis

Connect rate is the fastest read on lead quality when GHL close data is still maturing. An ad with a
great CPL but a 19% connect rate is producing leads nobody can reach — the CPL is lying. Cost-per-
booked-call (using appointments) is a strong true-north metric; see `references/metrics-glossary.md`.
