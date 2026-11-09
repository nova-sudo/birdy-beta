# BirdyHub redesign: hub, Media Buying Agent, new agent setup

- **Date:** 2026-11-09
- **Ticket:** [BirdyHub UI redesign: before and after](https://app.clickup.com/t/1an065h2g3n)
- **Reference build:** `birdy-hub-redesign.zip` on the ticket. It is a front-end mock with scripted chats. Click-through: https://birdy-hub.vercel.app/hub
- **Repos:**
  - `birdy-beta` on branch `feat/hub-redesign`, in worktree `birdy-beta-hub-redesign`
  - `birdy-backend` on branch `feat/hub-redesign`, in worktree `birdy-backend-hub-redesign`

## Goal

Make BirdyHub, the Media Buying Agent (the "stock agent") and new agent setup simpler and more familiar to media buyers:

- a sheet instead of a long report;
- a chat about a client instead of an Approve/Deny button on every row;
- lessons that come from what people tell Birdy;
- setup done as a conversation instead of a wizard of forms.

The mock is the visual reference. This spec makes it real: real AI, real data, real Meta writes through the existing apply paths.

## Decisions made in brainstorming

| Topic | Decision |
|---|---|
| Client chat | Real AI, and it can act: apply or skip lines, edit the card, save lessons |
| Shipping | One spec, one plan |
| Old Report-tab extras | Dropped from the UI to match the mock. Backend routes stay. |
| Whole-month views | In scope (new backend aggregation) |
| Setup | One chat drives all 6 steps, with pickers shown inside the chat |
| Ready score | Unchanged. Practice cases happen inside the setup chat. |
| Chat plumbing | Extend `/api/chat` (orchestrator pages and tools). No streaming. |
| "Still to add" | Only "first report preview and ready score before Turn on" is in scope |

## Out of scope

- Chatting about the playbook from Settings.
- Lessons added automatically from repeated feedback.
- UI rules for what each new agent's page should look like.
- Sending messages to a client's own Slack. ("Draft a client message" only drafts text.)
- The page of a live custom agent (Work / Playbook / Train / Activity).
- Dashboards and reports, beyond the hub cards.
- Streaming chat replies.
- These old Report-tab parts are removed from the page, but their backend stays:
  - the answer box;
  - alerts not tied to a client;
  - follow-ups;
  - the scoreboard summary and "Make it a rule?";
  - "What I learned";
  - the weekly message panel;
  - "Apply N changes";
  - the Scoreboard tab.

  The weekly Slack post and the proposal jobs keep running server-side.

---

## 1. BirdyHub (`src/app/hub/page.jsx`)

- **Sections:** Agents, Dashboards, Reports, in that order. Each header row has its "New …" button on the right:
  - "New agent" links to `/hub/agents/custom/new`.
  - "New dashboard" opens the existing `NewDashboardDialog`.
  - "New report" opens the existing `ReportPanel` sheet.
- **Agent cards:** compact cards in a grid, built as one shared `HubCard`.
  - Content: icon, name, a "Default" tag on the Media Buying Agent, one line of description, and a status line.
  - Status values are "Live", "Setting up" and "Turned off". A live agent with open work adds " · N to decide":
    - for the stock agent, N is `openCards` from `useLatestRun`;
    - for custom agents, N is `useAgentWorkCount`.
  - The whole card is a link.
- **Stock agent states:**
  - Agent missing: clicking the card runs `createStockAgent()` and then opens setup, keeping today's 409 refetch.
  - Draft: the card opens setup.
  - Live or turned off: the card opens the agent page.
  - "Start over" and "Turn on" move into the agent page and setup.
- **Dashboards and reports** use the same compact card shape. Their dialogs, sheets, the Slack-not-connected empty state and the report limit don't change.
- **Empty sections** show one card with an icon, a sentence and the "New …" button.
- **Removed:** `STOCK_POINTS`, `CustomAgentsFrame` and `CreateCustomAgentCard`.

## 2. Media Buying Agent page (`src/app/hub/agents/media-buying/page.jsx`)

### 2.1 Frame

- **`PageHeader`:**
  - back link to BirdyHub;
  - title "Birdy Media Buying Agent";
  - description "Checks your clients every morning and drafts changes for you";
  - `actions` holds the **`ReportPicker`**.
- **ReportPicker:** a menu of runs grouped by month header, newest first. Today's run is marked "· Today". Under a "Whole months" header it lists each month that has runs. It keeps the "Older reports" paging from `useRuns`, and the URL keeps `?run=` and gains `?month=YYYY-MM`.
- **Tabs:** `SegmentedTabs` with Report, Lessons and Settings, synced to `?tab=`.
  - Old values `?tab=report` and `?tab=scoreboard` land on Report.
  - All three panels stay mounted, so open chats survive a tab switch.
- **The line to the right of the tabs:**
  - Report, today's run: "**N to decide** · X ads stopped · Y stop soon · a better, b worse". Each part is left out when it is zero. The tooltip on "better, worse" names the clients.
  - Report, a past run or month: "**Read-only** · {range} · a better, b worse · Back to today's report".
  - Settings: the status line (§4.2).
- **States kept from today:**
  - no agent redirects to setup;
  - a draft shows the "Finish setup" empty state;
  - a turned-off agent shows the `TurnOn` empty state;
  - no report yet shows its empty state;
  - plus the error and 404 states.
- `MorningReport`, `ReportClients`, `CardPanel` (as a panel), `FollowUps`, `ScoreboardFrame`/`ScoreboardTab`, `LearnedFrame`, `WeeklyMessage` and `AlertsFrame` come off this page. They are deleted if nothing else imports them (the plan will check).

### 2.2 The sheet (`ClientSheet`)

- **Built on** the DS `DataTable` (dense, with `onRowClick`). Columns:
  - **Client**: a button that opens the chat.
  - **Leads**
  - **CPL**: a chip coloured by zone (green, amber, red, grey). The tooltip says which line the CPL is under or over.
  - **Ad spend**
  - **Birdy**: one status chip.
- **Order:** a "Most urgent / Best to worst" segmented control. Past runs and months are always ranked.
  - **Most urgent:** clients to decide first, in the existing worst-first order (`clientRows`). Then the rest by CPL rising. Then clients with no figures.
  - **Best to worst:** a rank column appears. Clicking the Leads, CPL or Ad spend header ranks by it (most leads, lowest CPL, most spend). The top 3 are highlighted, except when ranking by spend.
- **Search** shows from 10 clients up.
- **Clients with no figures** show "No figures" across the three number columns. They stay behind a "Show N clients with no figures" row unless a search is running or Birdy needs a decision on them.
- **Birdy chip,** taken from the card:

  | Card | Chip |
  |---|---|
  | `decision == spend_stopped` or an "ads stopped" alert | Ads stopped (red ring) |
  | open card with proposed lines (count = `openLines`) | N changes; adds a clock icon when an alert says ads stop soon |
  | no lines but a "stops soon" alert | Stops soon |
  | flagged / problems needing a look | Check |
  | applied / partly_applied / dismissed | Done |
  | nothing | — |

  Past runs and months show "N decided" (cards with `decided_at` in range), or "—".
- **Deep links:** `?client=<gid or name>` opens that client's chat once, then the parameter is removed from the URL. Slack links keep working.
- **Data:**
  - Today and past runs come from the existing `useRun(agentId, runId)`.
  - A month comes from `useMonth(agentId, month)` (§6.4).
  - "Better/worse" compares each card's `previous_cpl` zone with its `current_cpl` zone, using the client's target zones.
- **Backend addition:** cards gain a top-level `spend` (the client's total spend in the card's window), computed where `leads` and `current_cpl` already are. The sheet shows "—" for spend if it's missing on an old card.

## 3. Client chat (`ClientChatDialog`)

### 3.1 UI

- **Container:** a centred DS `Dialog` sized like the mock. Focus returns to the row when it closes.
- **Header:** the client name, then the figures row: Leads, CPL chip, Last week (previous CPL) and Ad spend.
- **Body:** `ChatConversation` with these props:
  - `page="stock_card"`, `agentId`, `clientGroupId`, `clientName`;
  - a new `cardId` prop, passed through chat-store as `card_id`;
  - `sessionKey="stock_card:{card_id}"`;
  - `showScopePicker={false}`.
- **Opening message.** Birdy's first message is built on the client from the card, with no AI call:
  1. Alert headline in bold, if any, with its detail line (for example "Card on file: Expired · Live ads: 3").
  2. "Here's what I'd do:" and the numbered lines. Each shows the verb (Remove, Add or Turn back on) coloured by type, the ad name, and a one-line reason built from the line's spend, leads, CPL and flags.
  3. The effect, for example "Yes to all 2 leaves 1 ad live", from `ads_live` minus removals.
  4. The question: "Want me to do all N?", or "Want me to do it?" for one line.

  A green card or one with no lines says what Birdy checked and that nothing needs doing.
- **Quick replies** sit above the composer and are built from the card:
  - **"Yes to all N"** calls `actions.applyCard(cardId)` directly, with no AI call. A local Birdy message then lists each line's result: applied, failed with reason, or needs a file (with the upload button from today's `Line`).
  - **"Why this?"** sends a real message.
  - **Alert-specific questions** send a real message (for example "What happens if it isn't paid?").
  - **"Draft a client message"** sends a real message.
  - **Links** such as "Open billing in Meta" show only when that alert applies.
  - **"Set targets"** shows when the client has no target. It opens Settings › Clients and targets on that client's row.
- **Composer:** "Tell Birdy what to do…".
- **Footer:** "N left to decide" and "Skip for now: {next client} ›", which goes to the next client still to decide in sheet order.
- **Chips after a reply:** `renderAfterMessage` shows chips from `agent_changes`, such as "2 applied", "Card skipped" or "Lesson saved". Any card-changing tool triggers `revalidateStock`.
- **Past runs and months** open the same dialog:
  - The opening message says what was decided (from `decided_by`, `final_status` and line states) and how the CPL moved.
  - The composer stays available for questions; action tools refuse (§3.2).
  - A client outside today's batch, opened from today's sheet, opens on their own latest card.
- **Reload:** `GET /api/agents/{id}/cards/{cid}/chat` seeds the conversation (§3.3), so a reload shows the history.

### 3.2 Backend: `stock_card` page

- **Request:** `ChatRequest` gains `card_id: str | None`. With `page == "stock_card"`, `routers/chat.py`:
  - loads the card, owner-checked through the agent, and 404s if it isn't found;
  - sets a `current_stock_card` ContextVar, the same pattern as `current_training_agent`.
- **System prompt** (`ai/prompts/stock_card_chat.py`):
  - the card facts: client, zone and targets, window, previous and current CPL, leads, spend, ads live;
  - the lines with their IDs, state, mode, figures and flags;
  - `thought_process`, `additional_changes`, `next_steps` and alerts;
  - `lessons_for_prompt(db, agent_id, gid)`;
  - the same trust-boundary wording as `prompts/stock_agent.py`.

  Rules for Birdy:
  - short plain answers, in the voice of the mock;
  - never claim an action without a successful tool result;
  - ask before acting on a vague instruction;
  - when the user's answer contains a reusable preference, offer to save it as a lesson, or save it when they say "always" or "never".
- **Tools** (`ai/tools/stock_card_tools.py`). Each returns `{ok, changed}` or `{ok: false, error}`. All go through the existing functions, so guardrails, modes, write leases, the version lock and Slack card updates still apply.
  - `get_card()`: current card state.
  - `apply_card_lines(line_ids: list[str] | None)`: `stock.apply.apply_card`.
  - `dismiss_card(reason: str | None)`: `stock.apply.dismiss_card`. The reason becomes a lesson, the same as today.
  - `edit_card(keep_line_ids?, additional_changes?, thought_process?, next_steps?)`: the same logic as PATCH `/cards/{id}`, including `lesson_from_edit`.
  - `add_lesson(text, scope: "client" | "all")`: `lesson_from_text`, with `source="chat"`, `source_ref=card_id`, the author, and `client_group_id` when the scope is the client.
  - `draft_client_message(tone?)`: returns text only and never sends anything.
- **Refusals:** a card that isn't open (past run, superseded, applied) makes the action tools return `{ok: false, error: "card_closed"}`. Birdy then explains this in words.
- **Modes:** a Flag-mode line can't be applied, because `apply_card` already refuses it. Birdy says that the setting is Flag and offers to open Settings.
- **Plumbing:** the tool allow-list and system prompt are registered in `orchestrator.py` the same way as `agent_training`. Card-tool results go into `agent_changes`.
- **Credits:** normal chat credits, and the 402/412 handling doesn't change. The opening message and "Yes to all" cost nothing.

### 3.3 Persistence

- **Archive:** `ai_conversation_log` entries gain optional `agent_id` and `card_id` fields, written when the page is `stock_card`, `stock_lessons` or `agent_setup`.
- **New index:** `(user_id, card_id, created_at)`.
- **Read route:** `GET /api/agents/{id}/cards/{cid}/chat` returns `{session_id, messages: [{role, content, agent_changes?, created_at}]}`, owner-checked. The latest session for that card is reused through `seedSessionId`.
- These sessions don't appear in the Ask Birdy history list; filter on `page`.

## 4. Lessons and Settings

### 4.1 Lessons tab (`LessonsTab`, replaces `LessonsList`)

- **Header:** "N lessons. Birdy uses these on every run.", and a **Teach Birdy** button on the right.
- **Each lesson is one card row:**
  - an icon by type: remove/pause, revive/turn on, money/target, schedule/weekday, and other;
  - a meta line: the scope (client name or "All clients"), the source and the date;
  - the text, in bold;
  - "N× used" or "Not used yet" on the right, then a chevron.

  Source wording:

  | `source` | Wording |
  |---|---|
  | chat | You told Birdy in chat |
  | edit | You edited a card |
  | dismiss | You overruled a change on {client} |
  | slack_mention | Your comment in Slack |
  | promoted | From your results |
  | anything else | Added by Birdy |

  A lesson changed through Teach Birdy shows "You changed it in chat".
- **Order:** newest first.
- **Overruled lessons** sit behind "Show N overruled".
- **Clicking a row opens a DS `Sheet`** with:
  - the full text and its source, with "Open the chat" when `source_ref` is a card;
  - the last 5 uses, each as client and run date, linking to `?run=&client=`;
  - **Keep** (existing), **Overrule** (existing) and **Remove** (existing DELETE `/memory/{mid}`, with confirm and undo toast).
- **Teach Birdy** opens the chat dialog with `page="stock_lessons"`, `agentId` and session key `stock_lessons:{agent_id}`. Its tools are:
  - `list_lessons()`;
  - `add_lesson(text, client?)`;
  - `edit_lesson(id, text)`: rewrites the text, sets `source="chat_edit"` and keeps the history in `previous_texts`;
  - `remove_lesson(id)`: sets `active=false`.

  After a change it revalidates `useLessons`.
- **Backend usage tracking:**
  - `lessons_for_prompt` returns the IDs alongside the text.
  - After a card is saved, `runner._write_client` records the use with one `update_many`: `$inc: {uses: 1}` and `$push: {last_used: {$each: [{run_id, card_id, client_group_id, at}], $slice: -5}}`. Previews don't count.
  - `GET /lessons` returns `uses` (default 0) and `last_used`.
  - "Used" means the lesson was given to Birdy for that card. The UI copy doesn't claim more than that.

### 4.2 Settings tab

- **Sub-tabs** (`SegmentedTabs`, synced to `?tab=settings&section=`). Each shows one section, reusing today's component and save:
  - **What it can change**: `ModesSection` / `ModesTable`.
  - **Schedule**: `SetupSchedule`.
  - **Clients and targets**: `SetupClients`. It accepts `focusClient` to scroll to and highlight a row.
  - **Creative rules**: `SetupCreative`.
  - **Slack**: `SetupSlack` and `SlackTemplates`.
- **Status line beside the tabs:**
  - live: a pulse dot, "**Live** · next check {day} {time}", "Review setup ›" (link to setup) and Turn off (existing confirm);
  - turned off: "Turned off" and `TurnOn`;
  - draft: "Not on yet" and "Finish setup".
- **Opening a client from the chat:** "Set targets" opens `section=clients&client=<gid>`.

## 5. New agent setup (chat)

### 5.1 UI (`src/app/hub/agents/custom/new/page.jsx` and `custom/[id]/setup/page.jsx`)

- **Title:** "Set up your new agent", with a back link to BirdyHub.
- **Both routes render `AgentSetupChat`:**
  - On `/new`, nothing exists until the first message. That message runs `createAgent({type: "custom", name: "New agent"})`, then `router.replace(customSetupPath(id))`, then sends the message.
  - On `/[id]/setup`, the draft resumes from the archived transcript (§3.3) and `training.steps`.
- **Chat:** `ChatConversation` with `page="agent_setup"`, `agentId` and session key `agent_setup:{id}`.
  - The first Birdy message is local: "Let's build this one from scratch. **What should the agent do?**"
  - Placeholders: "Tell Birdy what the agent should do…", then "Type your answer…".
- **Example jobs** sit above the composer before the first answer: "Pause ads that cost too much", "Turn old winners back on" and "Flag ad sets with no spend". They are fixed for now; the code marks them `// later: from what each team asks Birdy most`.
- **Inline blocks.** Each one is a React component chosen by `renderAfterMessage` from that message's `agent_changes` or `ui_block` tool result:

  | Block | What it shows | What it saves |
  |---|---|---|
  | `PlaybookBlock` | the drafted rules as a numbered list, "Its playbook · N rules", with "Yes, that's it" / "Change something" | — |
  | `ClientsBlock` | a compact `ClientScopeTable` | through `patchAgent`, handling `ClaimConflicts` |
  | `PermissionsBlock` | a compact `GuardrailsForm` | through `patchAgent` |
  | `ScheduleBlock` | time and timezone | — |
  | `SlackBlock` | a channel picker (same data as `SetupSlack`) | — |
  | `PracticeBlock` | one `PracticeCase` | — |
  | `PreviewBlock` | `DryRunSummary`, after `startDryRun` / `pollJob` | — |

  When a block saves, a short user message is sent (for example "Picked 6 clients"), so Birdy moves on.
- **Right rail (`SetupRail`):**
  - "Setup · n of 6" with a progress bar.
  - The steps: What it does, Its playbook, Clients, What it can change, Report time, Slack. Each shows:
    - a tick and a one-line answer once done;
    - "Change", which sends "I want to change {step}";
    - "Asking now" on the current step;
    - a grey circle otherwise.
  - Below the steps: a compact `ConfidenceMeter` (score, threshold 80, what's missing).
  - **Turn on** (`activateAgent`, then go to `customAgentPath`). It is disabled until `ready`, with the note "Unlocks once I've asked everything".
  - Below 1024px the rail folds into a collapsible bar above the chat.
- **Removed:** `WizardSteps`, `ScopeStep` and `CheckStep`, and the setup use of `AgentTraining`. `AgentTraining` and `TrainingChat` stay for the Train tab on the live agent page.

### 5.2 Backend: `agent_setup` page

- **Prompt** (`ai/prompts/agent_setup.py`): ask one step at a time in the rail's order, skip steps already done, and go back when asked to change one. Then run practice and the preview:
  1. **What it does**: `set_purpose(name, description)` saves the name and description and marks the step.
  2. **Its playbook**: `draft_playbook(rules: [{kind, enabled, params}])` writes to `agent_rules` through the same code as `set_rule_param`, then returns the playbook for `PlaybookBlock`.
     - When the user confirms, `confirm_playbook()` marks the step and sets `training.topics.{targets?,pause,revive,flags}`, so coverage maths doesn't change.
     - Only the 4 existing rule kinds exist: `pause_over_target`, `revive_winner`, `flag_no_spend` and `flag_declining`. If asked for a job they can't do, Birdy says plainly what it can do and what it can't.
  3. **Clients**: `show_block("clients")`. After the save, Birdy asks for any missing CPL targets through the existing `set_client_target`.
  4. **What it can change**: `show_block("permissions")`.
  5. **Report time**: `set_schedule(time, tz)`, which understands "7am", or `show_block("schedule")`.
  6. **Slack**: `set_slack(channel_id)` or `show_block("slack")`.
- **Then:**
  - `ask_practice_case()` fetches the next case through `replay.sample_cases` / the practice store and returns it for `PracticeBlock`. Birdy keeps going until the score is 80 or more, or it runs out of cases. Answers and resolution use the existing practice endpoints, so `confidence.py` doesn't change.
  - `run_preview()` starts the dry run and returns the job ID for `PreviewBlock`.
- **The tool list** also includes today's training tools (`get_playbook`, `set_rule_param`, `set_client_target`, `set_client_override`, `add_memory`, `add_exception`), all limited to custom agents.
- **`training.steps`:** `{purpose, playbook, clients, permissions, schedule, slack}`, booleans set by the tools and by the matching PATCHes. `_agent_to_api` returns it. The rail reads the steps from the agent and the score from `useAgentConfidence`.
- **Slack per agent:**
  - `scope.slack_channel_id` (optional) is validated against the user's Slack workspace channels.
  - `ai/agents/runner.py` passes it to `post_new_suggestions(..., channel_id=...)`. With no channel set it falls back to `get_notify_target`, the same as today.

## 6. Backend summary

1. `ChatRequest.card_id`, the `current_stock_card` ContextVar, and the pages `stock_card`, `stock_lessons` and `agent_setup` in the orchestrator, each with its prompt and tool allow-list.
2. Tools:
   - `stock_card_tools.py`: get_card, apply_card_lines, dismiss_card, edit_card, add_lesson, draft_client_message.
   - `stock_lesson_tools.py`: list, add, edit and remove lessons.
   - New setup tools in `agent_tools.py`: set_purpose, draft_playbook, confirm_playbook, show_block, set_schedule, set_slack, ask_practice_case, run_preview.
3. Lessons: `uses` and `last_used` written in `_write_client`, returned by `GET /lessons`. `edit_lesson` keeps `previous_texts`.
4. **Months:** `GET /api/agents/{id}/months/{YYYY-MM}` returns `{month, range, rows: [{client_group_id, client_name, leads, spend, cpl, zone, decided}]}`.
   - It sums `agent_ad_days` for the agent's scoped clients over the month, in the agent's timezone.
   - `decided` counts cards decided in the month.
   - Future months return 400; months before the history start are empty.
   - Front-end hook: `useMonth(agentId, month)`.
5. Cards gain `spend`.
6. Chat archive: `agent_id` and `card_id` on `ai_conversation_log`, a new index, and `GET /api/agents/{id}/cards/{cid}/chat`. Ask Birdy history excludes these pages.
7. Agents: `training.steps` and `scope.slack_channel_id`. The custom runner passes the channel to the Slack notifier.

## 7. Errors and edge cases

- **Chat call fails** (network, 5xx): the existing `ChatConversation` error and retry. The card isn't touched.
- **402 / 412:** the existing credits and AI-key states inside the dialog. Quick "Yes to all" still works, because it makes no AI call.
- **Tool races:** a version conflict on edit, or an apply on a busy card, returns `{ok: false, error}`. Birdy says the card changed and re-reads it with `get_card`, and the sheet revalidates.
- **Apply results:** these are partial per line (failed, blocked, needs_file) and shown line by line, as in `CardPanel` today.
- **Setup:**
  - Creating the agent on the first message can fail. The message stays in the composer and an error shows.
  - A 409 claim conflict on clients shows `ClaimConflicts` inside `ClientsBlock`.
  - Leaving mid-setup keeps the draft. The hub card says "Setting up" and opens the chat where it stopped.
- **Months:** a client with no ad days in the month shows "No figures".

## 8. Testing

- **Backend (pytest):**
  - each new tool: success, refusal on a closed card, owner scoping, Flag-mode refusal, and lesson creation with the source fields;
  - the month aggregation (timezone edges, empty months, future month);
  - lesson `uses`/`last_used` written once per card and not for previews;
  - the chat transcript route's owner check;
  - `training.steps` set by each setup tool;
  - the Slack channel override, including the fallback.
- **Frontend (vitest + Testing Library):**
  - `ClientSheet`: ordering modes, rank by column, search threshold, tucked no-figure rows, chip mapping, `?client=` deep link.
  - `ClientChatDialog`: opening message from a card fixture, "Yes to all" calling `applyCard` and rendering line results, Skip to the next client, read-only past card.
  - `LessonsTab`: source wording, used counts, the detail sheet actions.
  - Settings sub-tabs and the focus-client highlight.
  - `AgentSetupChat`: agent created on the first message, the rail driven by `training.steps`, each inline block saving, Turn on gated by `ready`.
  - Update `hub.test.jsx` and the setup page tests. Delete the tests of removed components.
- **By hand:** a local build with `NEXT_PUBLIC_API_URL` pointed at the local backend, then crawl and screenshot each screen against the 7 "after" screenshots on the ticket. Then a real card chat on a test client, with apply, skip and lesson, and a full setup to Turn on.

## 9. Build order (for the plan)

1. **Backend data:** card `spend`, lesson usage, month route, `training.steps`, `scope.slack_channel_id`, chat archive fields and route.
2. **Backend chat:** the `stock_card`, `stock_lessons` and `agent_setup` pages and their tools.
3. **Hub page.**
4. **Media Buying page frame:** header picker with months, tabs, summary line.
5. `ClientSheet`.
6. `ClientChatDialog`.
7. `LessonsTab` and Teach Birdy.
8. Settings sub-tabs.
9. `AgentSetupChat` with the rail and inline blocks.
10. Remove dead components and tests, then verify everything with screenshots.
