# BirdyHub Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild these screens from the ticket's redesign, with real AI and real data:
- BirdyHub;
- the Media Buying Agent (a sheet, a per-client AI chat, Lessons, Settings sub-tabs);
- custom agent setup, as a single chat.

**Architecture:**
- **Backend** (FastAPI + Motor):
  - three new orchestrator pages (`stock_card`, `stock_lessons`, `agent_setup`), each with its own prompt and tools; the tools wrap the existing apply, dismiss, lesson and rule code;
  - a month aggregation route;
  - lesson usage tracking;
  - per-agent Slack channels;
  - a chat transcript route per card.
- **Frontend** (Next.js, JSX, DS kit):
  - the Media Buying page and setup pages are rebuilt on `DataTable`, `Dialog`, `Sheet` and the shared `ChatConversation`, with new inline blocks for setup.

**Tech Stack:**
- Backend: Python 3, FastAPI, Motor, pytest (`asyncio_mode=auto`).
- Frontend: Next.js, React, SWR, Tailwind v4, the DS kit in `src/components/ds`, vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-09-birdyhub-redesign-design.md` (birdy-beta). Read it first: copy, chip mapping and source wording are pinned there, and tasks below cite its section numbers.

**Repos:**
- `BE` = `/Users/abdelrahman/Desktop/Birdy/birdy-backend-hub-redesign`
- `FE` = `/Users/abdelrahman/Desktop/Birdy/birdy-beta-hub-redesign`

Both are on branch `feat/hub-redesign`.

**Reference mock:** `/private/tmp/claude-501/-Users-abdelrahman-Desktop-Birdy/c4c615f2-c6bf-48e4-a439-fa87f37fd109/scratchpad/redesign/birdy-hub-redesign`.
- Look and copy only. Never import from it.
- Its `app/globals.css` classes `sb-*`, `hb-*`, `mb-*` and `cc-*` show spacing and colour intent. Rebuild them with DS tokens and Tailwind; don't copy the CSS.

## Global Constraints

**Frontend:**
- UI must use the DS kit (`@/components/ds`). Don't add new global CSS classes.
- Fonts: Bricolage for headings and numbers (`font-display`), Inter for body text. Numbers use `tabular-nums`.
- The Birdy mascot only ever appears inside `BirdyAvatar` (`src/components/birdy/BirdyAvatar.jsx`), never bare.
- Money is formatted with the existing `money()` from `src/lib/stock-agent-api.js`, in the client's currency.
- Copy is exactly as the spec writes it ("N to decide", "Tell Birdy what to do…", "Unlocks once I've asked everything", and so on).

**Backend:**
- Every new route and tool is owner-scoped. Another user's agent or card returns 404, or `{ok: false, error: "not_found"}` from a tool.
- Tools return `{"ok": True, "changed": <str>, ...}` or `{"ok": False, "error": <code>}`. They never raise for user errors.
- Tool executor signature: `async def tool(db, user_id, mongo_client=None, **kwargs) -> dict`. The orchestrator passes `db`, `user_id` and `mongo_client` as keyword arguments (`ai/orchestrator.py:926`).
- No streaming. `/api/chat` stays one JSON response.
- Previews (`run.kind == "preview"`) never count lesson uses and never post to Slack.

**Process:**
- Tests: backend `cd BE && pytest tests/<file> -q`; frontend `cd FE && npx vitest run <path>`.
- Commit after every task, with this footer:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## Review Focus

1. **A card changes while its chat is open.** For example, the cron applies it or Slack dismisses it. The tools must refuse with `card_closed` or `conflict`, Birdy must re-read the card, and the sheet must revalidate. Never apply twice.
   *Tests: Task 6 (`test_apply_on_closed_card_refuses`) and Task 13 (`revalidates on agent_changes`).*
2. **Free-text instructions that map to Flag-mode lines.** Birdy must not claim it applied anything; the tool result decides.
   *Tests: Task 6 (`test_apply_flag_line_reports_not_applied`).*
3. **A client in the sheet with no card in the open run** (outside today's batch, or a late client). The row must still open a chat, on that client's latest card, read-only. A client with no card at all opens no chat.
   *Tests: Task 12 (`opens latest card for client outside batch`, `row without any card is not clickable`).*
4. **Month boundaries in the agent's timezone.** A day at 23:30 UTC on the 31st, for an agent in Europe/London during BST, belongs to the next month.
   *Tests: Task 3 (`test_month_uses_agent_timezone`).*
5. **Setup abandoned after the draft agent is created on the first message.** A reload must resume the transcript and the rail, and must not create a second agent.
   *Tests: Task 16 (`resumes existing draft without creating`).*

---

## File Structure

**Backend (BE):**

| File | Role |
|---|---|
| `ai/agents/stock/cards.py`, `ai/agents/stock/runner.py` | Modify: card `spend`; lesson-use recording after a card is saved |
| `ai/agents/stock/lessons.py` | Modify: `lessons_for_prompt` returns IDs; new `record_lesson_uses`, `edit_lesson_text` |
| `ai/agents/stock/months.py` | Create: `month_rows(db, agent, month)` |
| `routers/agent_stock.py` | Modify: `GET /{id}/months/{month}`, `GET /{id}/cards/{cid}/chat`; lessons return `uses`/`last_used` |
| `ai/conversation_log.py` | Modify: `agent_id` / `card_id` fields and index; `card_transcript()` |
| `core/models.py`, `routers/chat.py` | Modify: `ChatRequest.card_id`; ContextVars for the new pages; history excludes them |
| `ai/tools/stock_card_tools.py` | Create: card chat tools |
| `ai/tools/stock_lesson_tools.py` | Create: Teach Birdy tools |
| `ai/tools/agent_tools.py` | Modify: setup tools; `training.steps` |
| `ai/prompts/stock_card_chat.py`, `ai/prompts/stock_lessons_chat.py`, `ai/prompts/agent_setup.py` | Create: system prompts |
| `ai/orchestrator.py` | Modify: register the 3 pages (tool lists + prompts) |
| `routers/agents.py`, `ai/agents/runner.py` | Modify: `scope.slack_channel_id`, `training.steps` in the API; notifier channel |

**Frontend (FE):**

| File | Role |
|---|---|
| `src/components/hub/HubCard.jsx` | Create: compact card |
| `src/app/hub/page.jsx` | Modify: new layout |
| `src/lib/stock-agent-api.js` | Modify: `useMonth`, `useCardChat`, lessons fields |
| `src/components/agents/stock/sheet/rows.js` | Create: pure sheet logic (chips, order, zones, better/worse) |
| `src/components/agents/stock/sheet/ClientSheet.jsx` | Create |
| `src/components/agents/stock/sheet/ReportPicker.jsx` | Create: runs plus months |
| `src/components/agents/stock/sheet/SheetSummary.jsx` | Create |
| `src/components/agents/stock/chat/opening.js` | Create: the opening message and quick replies from a card (pure) |
| `src/components/agents/stock/chat/ClientChatDialog.jsx` | Create |
| `src/components/agents/stock/LessonsTab.jsx`, `LessonSheet.jsx`, `TeachBirdyDialog.jsx` | Create; replaces `LessonsList.jsx` |
| `src/components/agents/stock/AgentSettings.jsx` | Modify: sub-tabs, status line, `focusClient` |
| `src/app/hub/agents/media-buying/page.jsx` | Modify: new frame |
| `src/components/chat/ChatConversation.jsx`, `src/lib/chat-store.js` | Modify: `cardId` pass-through |
| `src/components/agents/setup/AgentSetupChat.jsx`, `SetupRail.jsx`, `blocks/*.jsx`, `steps.js` | Create |
| `src/app/hub/agents/custom/new/page.jsx`, `custom/[id]/setup/page.jsx` | Modify: render `AgentSetupChat` |

---

## Phase A: Backend data

### Task 1: Card `spend` and lesson usage tracking

**Files:**
- Modify: `BE/ai/agents/stock/cards.py` (`build_card`, near :134)
- Modify: `BE/ai/agents/stock/lessons.py` (`lessons_for_prompt`, :165)
- Modify: `BE/ai/agents/stock/runner.py` (`_write_client`, :710-722)
- Modify: `BE/routers/agent_stock.py` (`GET /{id}/lessons`, :558)
- Test: `BE/tests/test_stock_lessons.py`, `BE/tests/test_stock_runner.py`

**Interfaces:**
- Produces:
  - `card["spend"]: float | None`: the sum of the client's ad spend in the card's window, taken from the same facts that give `leads` and `current_cpl`.
  - `lessons_for_prompt(db, agent_id, gid, *, with_ids=False) -> list[str] | list[tuple[str, str]]`. With `with_ids=True` it returns `(id, text)` pairs. Existing callers don't change.
  - `record_lesson_uses(db, ids: list[str], *, run_id, card_id, client_group_id) -> None`.
  - Lesson API docs gain `uses: int` (default 0) and `last_used: list[{run_id, card_id, client_group_id, at}]`, newest last, at most 5.

- [ ] **Step 1: Write the failing tests**
  - `test_record_lesson_uses_increments_and_caps`: 6 calls give `uses == 6`, `len(last_used) == 5`, and the last entry is the 6th call's `card_id`.
  - `test_write_client_records_uses_not_for_preview`: a scheduled run increments; a preview run leaves `uses` missing.
  - `test_card_has_spend`: facts with ads spending 10.5 and 4.5 give `card["spend"] == 15.0`.
  - `test_lessons_route_returns_uses`: a lesson without the field returns `uses: 0, last_used: []`.
- [ ] **Step 2:** Run `pytest tests/test_stock_lessons.py tests/test_stock_runner.py -q`. Expected: FAIL.
- [ ] **Step 3: Implement**
  - `record_lesson_uses` is a single `update_many({"_id": {"$in": ids}}, {"$inc": {"uses": 1}, "$push": {"last_used": {"$each": [entry], "$slice": -5}}})`.
  - In `_write_client`, call it after the card is saved, and only when `run.get("kind") != "preview"`.
  - In the lessons route, add `uses` and `last_used` defaults.
- [ ] **Step 4:** Run the same tests. Expected: PASS. Then run the whole suite with `pytest -q`; there must be no new failures.
- [ ] **Step 5:** Commit: `feat(stock): card spend and lesson usage tracking`.

### Task 2: Lesson text edits and the shared lesson helpers

**Files:**
- Modify: `BE/ai/agents/stock/lessons.py`
- Test: `BE/tests/test_stock_lessons.py`

**Interfaces:**
- Produces:
  - `edit_lesson_text(db, agent_id, lesson_id, text, *, author) -> dict | None`.
    - It sets `text`, `source="chat_edit"` and `edited_at`, and pushes the old text onto `previous_texts`.
    - It returns `None` if the lesson doesn't belong to the agent.
  - `remove_lesson(db, agent_id, lesson_id) -> bool`. It sets `active=False`, the same as the DELETE `/memory/{mid}` route.

- [ ] **Step 1:** Write the failing tests:
  - `test_edit_lesson_keeps_history`
  - `test_edit_lesson_other_agent_returns_none`
  - `test_remove_lesson_deactivates`
- [ ] **Step 2:** Run the tests and confirm they FAIL.
- [ ] **Step 3:** Implement both functions. Make the DELETE `/memory/{mid}` route call `remove_lesson`, so there is one code path.
- [ ] **Step 4:** Run the tests and confirm they PASS.
- [ ] **Step 5:** Commit: `feat(stock): edit and remove lessons`.

### Task 3: Month aggregation route

**Files:**
- Create: `BE/ai/agents/stock/months.py`
- Modify: `BE/routers/agent_stock.py`
- Test: `BE/tests/test_stock_months.py`

**Interfaces:**
- Produces:
  - `month_rows(db, agent: dict, month: str) -> dict`, returning:
    ```
    {"month": "2026-10", "range": "1 Oct – 31 Oct",
     "rows": [{"client_group_id", "client_name", "leads", "spend", "cpl", "zone", "decided"}]}
    ```
  - **Clients:** `agent.scope.client_group_ids`.
  - **Days:** the dates in the month, in `agent.scope.schedule.tz`. `agent_ad_days.date_start` is already a local Meta date string (YYYY-MM-DD), so filter by string range. Check this assumption in `ai/agents/meta_state.py` before relying on it, and note the result in the commit message.
  - **Figures:** `cpl = spend / leads` when there are leads, else `None`. With no rows, `leads`, `spend` and `cpl` are all `None`.
  - **Zone:** from the client's targets, using the existing zone helper that cards use. Find it with `grep -n "def .*zone" ai/agents/stock/*.py`.
  - **`decided`:** the count of the agent's `agent_cards` for that client whose `decided_at` falls inside the month.
  - **Route:** `GET /api/agents/{agent_id}/months/{month}`.
    - It validates `^\d{4}-\d{2}$` and returns 400 `bad_month`.
    - A future month (after the current month in the agent's timezone) returns 400 `future_month`.
    - It is owner-scoped through `_stock_agent`.

- [ ] **Step 1:** Write the failing tests:
  - `test_month_sums_ad_days`
  - `test_month_no_rows_is_null_figures`
  - `test_month_counts_decided`
  - `test_month_uses_agent_timezone`
  - `test_month_route_rejects_future_and_bad`
  - `test_month_route_other_user_404`
- [ ] **Step 2:** Run `pytest tests/test_stock_months.py -q` and confirm it FAILS.
- [ ] **Step 3:** Implement. Build `range` with the same short-day helper style the run labels use (for example "1 Oct – 31 Oct").
- [ ] **Step 4:** Run the tests and confirm they PASS.
- [ ] **Step 5:** Commit: `feat(stock): whole-month report rows`.

### Task 4: Chat archive fields and the card transcript route

**Files:**
- Modify: `BE/ai/conversation_log.py`
- Modify: `BE/core/models.py` (`ChatRequest`, :216)
- Modify: `BE/routers/chat.py`
- Modify: `BE/routers/agent_stock.py`
- Test: `BE/tests/test_chat_history.py`, `BE/tests/test_stock_router.py`

**Interfaces:**
- Produces:
  - `ChatRequest.card_id: Optional[str] = None`.
  - `log_message(..., agent_id: str | None = None, card_id: str | None = None)`. The fields are stored only when set.
  - A new index `(user_id, card_id, created_at)` in `create_conversation_log_indexes`.
  - `card_transcript(db, user_id, card_id) -> dict`, returning `{"session_id": str | None, "messages": [{"role", "content", "agent_changes", "created_at"}]}`. Messages come from the latest session for that card, in order. `[UI_RESPONSE]` turns are skipped.
  - `HIDDEN_HISTORY_PAGES = {"stock_card", "stock_lessons", "agent_setup"}` in `routers/chat.py`. `GET /api/chat/conversations` excludes those pages.
  - Route `GET /api/agents/{agent_id}/cards/{card_id}/chat`. It checks the card belongs to the agent and the agent to the user, then returns `card_transcript`.
  - `routers/chat.py` passes `agent_id` and `card_id` to `log_message` when the page is one of the hidden pages. It also stores `agent_changes` on the assistant entry.

- [ ] **Step 1:** Write the failing tests:
  - `test_log_message_stores_card_fields`
  - `test_history_hides_agent_pages`
  - `test_card_chat_route_returns_latest_session`
  - `test_card_chat_route_other_user_404`
- [ ] **Step 2:** Run the tests and confirm they FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests and confirm they PASS.
- [ ] **Step 5:** Commit: `feat(chat): archive card and agent chats, transcript route`.

### Task 5: `training.steps` and per-agent Slack channel

**Files:**
- Modify: `BE/routers/agents.py` (`_agent_to_api` :58; the PATCH `/{id}` validation)
- Modify: `BE/ai/agents/runner.py` (:270-278)
- Modify: `BE/services/slack_suggestion_notifier.py` (only if `post_new_suggestions` doesn't already accept `channel_id`)
- Test: `BE/tests/test_agents_router.py`, `BE/tests/test_agent_runner.py`

**Interfaces:**
- Produces:
  - `STEP_KEYS = ("purpose", "playbook", "clients", "permissions", "schedule", "slack")` in `ai/agents/store.py`.
  - `mark_step(db, agent_id, key) -> None` in `ai/agents/store.py`. It does `$set training.steps.<key> = True`.
  - `_agent_to_api` returns `training.steps`, with every key present (default `False`), plus `description` and `scope.slack_channel_id`.
  - PATCH `/{id}` accepts:
    - `scope.slack_channel_id: str | None`, and marks `slack` when it is set;
    - `description: str` (at most 280 characters);
    - and marks `clients` when `scope.client_group_ids` is non-empty, `permissions` when `permissions` or `guardrails` is sent, and `schedule` when `scope.schedule` is sent.
  - The custom runner calls `post_new_suggestions(db, user_id, docs, channel_id=agent.scope.get("slack_channel_id"))`. With `None`, the existing `get_notify_target` fallback applies.

- [ ] **Step 1:** Write the failing tests:
  - `test_agent_api_has_all_steps`
  - `test_patch_marks_steps`
  - `test_patch_slack_channel`
  - `test_runner_posts_to_agent_channel`
  - `test_runner_falls_back_to_notify_target`
- [ ] **Step 2:** Run the tests and confirm they FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests and confirm they PASS.
- [ ] **Step 5:** Commit: `feat(agents): setup steps and per-agent slack channel`.

## Phase B: Backend chat pages

### Task 6: `stock_card` page (tools, prompt, registration)

**Files:**
- Create: `BE/ai/tools/stock_card_tools.py`
- Create: `BE/ai/prompts/stock_card_chat.py`
- Modify: `BE/ai/orchestrator.py` (the page tool dict near :60-160, `_PAGE_SYSTEM_PROMPTS` :452-462, `agent_changes` collection :936)
- Modify: `BE/routers/chat.py` (around :81)
- Test: `BE/tests/test_stock_card_tools.py`, `BE/tests/test_stock_card_prompt.py`

**Interfaces:**
- Consumes:
  - `apply_card(db, mongo_client, user_id, card_id, *, by, source, line_ids=None, budget_s=None)`
  - `dismiss_card(db, user_id, card_id, *, by, source, reason=None)`
  - the card PATCH logic in `routers/agent_stock.py:292`. Move its body into `ai/agents/stock/cards.py` as `edit_card(db, user_id, card_id, *, lines=None, additional_changes=None, thought_process=None, next_steps=None, by=None) -> dict`, and have the route call it.
  - `lesson_from_text`
  - `lessons_for_prompt`
- Produces:
  - `current_stock_card: ContextVar[str | None]` in `stock_card_tools.py`. `routers/chat.py` sets it to `request.card_id` when `page == "stock_card"`, after loading the card with owner checks; it returns 404 `card_not_found` otherwise.
  - Tools, each an `async def name(db, user_id, mongo_client=None, **kw) -> dict`:
    - `get_card()` returns `{ok, card}`, where `card` has the facts, lines and status.
    - `apply_card_lines(line_ids=None)` returns `{ok, changed: "applied", lines: [...], outcome}`. It passes `by=user_id`, `source="chat"` and `budget_s=20`.
    - `dismiss_card(reason=None)` returns `{ok, changed: "dismissed"}`.
    - `edit_card(keep_line_ids=None, additional_changes=None, thought_process=None, next_steps=None)` returns `{ok, changed: "edited"}`.
    - `add_lesson(text, scope="client")` returns `{ok, changed: "lesson", lesson}`. It calls `lesson_from_text` with `source="chat"` and `source_ref=card_id`, and adds `client_group_id` when the scope is `client`.
    - `draft_client_message(tone=None)` returns `{ok, facts}`: a compact facts bundle the model writes the message from. It writes nothing.
  - Error codes:
    - `card_closed`: the card status isn't `open` or `flagged`, or it is a preview.
    - `conflict`: the version race, or busy (409 from the underlying code).
    - `expired`: 410.
    - `not_found`.
  - `STOCK_CARD_TOOL_NAMES` (a tuple) and `register_stock_card_tools()`, called beside `register_agent_tools()` in `routers/chat.py:53`.
  - `system_prompt(context: dict) -> str` in `stock_card_chat.py`.
    - It takes the card, the agent's target zones and the lessons.
    - Rules, verbatim intent from spec §3.2: short plain answers; never claim an action without a successful tool result; ask before acting on vague instructions; offer to save reusable preferences as a lesson, or save directly on "always" or "never".
    - It reuses the trust-boundary paragraph from `ai/prompts/stock_agent.py:45` by importing it.
  - Find the orchestrator's per-page prompt hook (`_build_client_detail_prompt` :476 is the model for an async builder that loads data), and register `"stock_card"` the same way.

- [ ] **Step 1:** Write the failing tests:
  - `test_apply_all_lines_calls_apply_card`
  - `test_apply_on_closed_card_refuses`
  - `test_apply_flag_line_reports_not_applied` (the result's `lines` show the Flag line not applied, and `ok` reflects `apply_card`'s outcome)
  - `test_dismiss_with_reason_makes_lesson`
  - `test_edit_card_conflict_returns_conflict`
  - `test_add_lesson_scoped_to_client`
  - `test_tools_other_users_card_not_found`
  - `test_prompt_contains_lines_and_lessons`
  - `test_chat_route_404_for_foreign_card`
- [ ] **Step 2:** Run `pytest tests/test_stock_card_tools.py tests/test_stock_card_prompt.py -q` and confirm it FAILS.
- [ ] **Step 3:** Implement, including the `edit_card` move. Run `tests/test_stock_router.py` to confirm the PATCH route behaves exactly as before.
- [ ] **Step 4:** Run the tests and confirm they PASS. Then run `pytest -q` and confirm there are no new failures.
- [ ] **Step 5:** Commit: `feat(chat): stock_card page with card tools`.

### Task 7: `stock_lessons` page

**Files:**
- Create: `BE/ai/tools/stock_lesson_tools.py`
- Create: `BE/ai/prompts/stock_lessons_chat.py`
- Modify: `BE/ai/orchestrator.py`
- Modify: `BE/routers/chat.py`
- Test: `BE/tests/test_stock_lesson_tools.py`

**Interfaces:**
- Consumes: the Task 2 functions, `list_memory` and `lesson_from_text`.
- Produces:
  - `current_lessons_agent: ContextVar`, set from `request.agent_id` when the page is `stock_lessons`, after checking a stock agent owned by the user.
  - Tools:
    - `list_lessons()` returns `{ok, lessons: [{id, text, client, source, uses}]}`.
    - `add_lesson(text, client_name=None)` returns `{ok, changed: "lesson"}`. Clients are matched by name, the same way as `_match_client` in `agent_tools.py`, and a miss returns `candidates`.
    - `edit_lesson(lesson_id, text)` returns `{ok, changed: "lesson_edited"}`.
    - `remove_lesson(lesson_id)` returns `{ok, changed: "lesson_removed"}`.
  - A system prompt that tells Birdy to restate the lesson in one short sentence and confirm before editing or removing.

- [ ] **Step 1:** Write the failing tests:
  - `test_add_lesson_by_client_name`
  - `test_add_lesson_unknown_client_candidates`
  - `test_edit_and_remove`
  - `test_foreign_lesson_not_found`
- [ ] **Step 2:** Run the tests and confirm they FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests and confirm they PASS.
- [ ] **Step 5:** Commit: `feat(chat): stock_lessons page`.

### Task 8: `agent_setup` page

**Files:**
- Modify: `BE/ai/tools/agent_tools.py`
- Create: `BE/ai/prompts/agent_setup.py`
- Modify: `BE/ai/orchestrator.py`
- Modify: `BE/routers/chat.py` (set `current_training_agent` for `agent_setup` too)
- Test: `BE/tests/test_agent_setup_tools.py`

**Interfaces:**
- Consumes:
  - `mark_step` (Task 5);
  - the existing rule writing from `set_rule_param`;
  - `answer_topic`;
  - `replay.sample_cases` and the practice store used by GET `/practice` (`routers/agents.py:628`). Move that sampling into `ai/agents/replay.py` as `next_practice_case(db, agent) -> dict | None` if it's inline in the router.
  - the dry-run job starter used by POST `/dry-run` (:539). Move it into a function the same way if it's inline.
- Produces new tools. All are limited to custom agents through `_agent`, and each returns `{ok, changed, ...}`:
  - `set_purpose(name, description)`: saves `name` (1–60 characters) and `description`, and marks `purpose`.
  - `draft_playbook(rules: [{kind, enabled, params}])`: `kind` must be in `RULE_KINDS`, and unknown params are refused. It writes through the same path as `set_rule_param` and PATCH `/rules/{rid}` (the `enabled` field). It returns `{ok, changed: "playbook", ui_block: "playbook", playbook}`.
  - `confirm_playbook()`: marks `playbook` and calls `answer_topic` for `pause`, `revive` and `flags` (and `targets` only if every watched client has a target).
  - `show_block(block)`: `block` is one of `clients`, `permissions`, `schedule` or `slack`. It returns `{ok, ui_block: block}` and writes nothing.
  - `set_schedule(time, tz=None)`:
    - It parses "7am", "07:00" and "7:30 pm" into `HH:MM`.
    - `tz` defaults to the agent's timezone, then the user's.
    - A bad value returns `{ok: False, error: "bad_time"}`.
    - It saves `scope.schedule` and marks `schedule`.
  - `set_slack(channel_id)`: checks the channel against the user's channels (use the same lookup as `SetupSlack`'s backend; `grep -rn "conversations_list\|channels" services/slack*`). It saves `scope.slack_channel_id` and marks `slack`.
  - `ask_practice_case()`: returns `{ok, ui_block: "practice", case}` in the public shape `{case_id, rule_kind, client_name, title, facts, options}`, never with `birdy_answer`. With no cases left it returns `{ok: False, error: "no_cases"}`.
  - `run_preview()`: returns `{ok, ui_block: "preview", job_id}`.
- The `agent_setup` tool list is these tools plus `get_playbook`, `set_rule_param`, `set_client_target`, `set_client_override`, `add_memory` and `add_exception`.
- The orchestrator copies a tool result's `ui_block` (with `playbook`, `case` or `job_id`) into that turn's `agent_changes` entry, so the frontend can render it.
- `agent_setup.system_prompt` follows the step order in spec §5.2, step by step:
  - it uses `get_playbook` and the `training.steps` value passed in the context to skip finished steps;
  - after `slack`, it runs practice until confidence is ready or `no_cases`, then `run_preview`;
  - it states the 4-rule-kinds limit plainly.

- [ ] **Step 1:** Write the failing tests:
  - `test_set_purpose_marks_step`
  - `test_draft_playbook_rejects_unknown_kind`
  - `test_draft_playbook_writes_rules`
  - `test_confirm_playbook_sets_topics`
  - `test_set_schedule_parses_times` (parametrised: "7am" gives "07:00", "7:30 pm" gives "19:30", "25:00" gives `bad_time`)
  - `test_set_slack_rejects_unknown_channel`
  - `test_ask_practice_case_hides_answer`
  - `test_setup_tools_refuse_stock_agent`
  - `test_ui_block_reaches_agent_changes`
- [ ] **Step 2:** Run the tests and confirm they FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `pytest tests/test_agent_setup_tools.py tests/test_agent_tools.py tests/test_agents_router.py -q` and confirm it PASSES.
- [ ] **Step 5:** Commit: `feat(chat): agent_setup page with setup tools`.

## Phase C: Frontend

### Task 9: API hooks and the chat-store `cardId`

**Files:**
- Modify: `FE/src/lib/stock-agent-api.js`
- Modify: `FE/src/lib/query-keys.js`
- Modify: `FE/src/lib/chat-store.js` (:107-133)
- Modify: `FE/src/components/chat/ChatConversation.jsx` (props :24-55 and the controlled request :233)
- Test: `FE/src/lib/__tests__/stock-agent-api.test.js`, `FE/src/lib/__tests__/chat-store.test.js` (create if missing)

**Interfaces:**
- Produces:
  - `useMonth(agentId, month) -> {month, rows, isLoading, error}`, from GET `/api/agents/{id}/months/{month}`. It isn't fetched when `month` is falsy.
  - `useCardChat(agentId, cardId) -> {sessionId, messages, isLoading}`, from GET `/cards/{cid}/chat`.
  - `removeLesson(agentId, lessonId)`, which wraps the existing memory DELETE. It is added to `useStockActions`.
  - `ChatConversation` gains a `cardId` prop. chat-store sends it as `card_id` in the POST body; it is omitted when undefined.
  - `queryKeys.stockMonth(id, month)` and `queryKeys.cardChat(id, cid)`.
  - Session seeding for `useCardChat` uses the existing `seedSessionId`.

- [ ] **Step 1:** Write the failing tests:
  - `sends card_id when cardId given`
  - `omits card_id otherwise`
  - `useMonth skips without month`
- [ ] **Step 2:** Run `npx vitest run src/lib` and confirm it FAILS.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests and confirm they PASS.
- [ ] **Step 5:** Commit: `feat(chat): card-scoped chat plumbing and month hook`.

### Task 10: BirdyHub page

**Files:**
- Create: `FE/src/components/hub/HubCard.jsx`
- Modify: `FE/src/app/hub/page.jsx`
- Modify: `FE/src/components/dashboards/DashboardList.jsx` / `DashboardCard`
- Modify: `FE/src/components/reports/ReportsSection.jsx` / `ReportCard`
- Test: `FE/src/app/hub/__tests__/hub.test.jsx`

**Interfaces:**
- Produces:
  - `<HubCard href|onClick icon title tag? line status? statusTone="ok"|"setting"|"off" extra? />`.
    - It renders as an `<a>` (Next `Link`) when `href` is given, otherwise as a `<button>`.
    - It shows a quiet trailing "Open ›" cue.
    - It is built from DS `Surface`, `Badge` and lucide icons.
- Page behaviour follows spec §1:
  - The three section header rows each have their "New …" button on the right.
  - Agent cards come from `useStockAgent`, `useLatestRun(agent?.id).openCards`, `useAgents` and `useAgentWorkCount`.
  - Clicking the stock card follows the state rules in spec §1, keeping the existing `createStockAgent` and 409 code moved from `StockAgentCard`.
- Delete `StockAgentCard`, `CustomAgentsFrame`, `CreateCustomAgentCard` and `STOCK_POINTS`.

- [ ] **Step 1:** Rewrite `hub.test.jsx` with failing tests:
  - `shows agents dashboards reports in order with New buttons on the right of each header`
  - `stock card shows N to decide when live with open cards`
  - `missing stock agent creates then routes to setup`
  - `draft stock card links to setup`
  - `custom agent card shows Setting up for draft`
  - `empty dashboards shows single empty card with New dashboard`
- [ ] **Step 2:** Run `npx vitest run src/app/hub/__tests__/hub.test.jsx` and confirm it FAILS.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests and confirm they PASS. Run `npx vitest run src/components/dashboards src/components/reports` and fix any broken card tests.
- [ ] **Step 5:** Commit: `feat(hub): compact BirdyHub layout`.

### Task 11: Media Buying page frame (picker, tabs, summary)

**Files:**
- Create: `FE/src/components/agents/stock/sheet/rows.js`
- Create: `FE/src/components/agents/stock/sheet/ReportPicker.jsx`
- Create: `FE/src/components/agents/stock/sheet/SheetSummary.jsx`
- Modify: `FE/src/app/hub/agents/media-buying/page.jsx`
- Test: `FE/src/components/agents/stock/sheet/__tests__/rows.test.js`, `FE/src/app/hub/agents/media-buying/__tests__/page.test.jsx` (create)

**Interfaces:**
- Produces (in `rows.js`, pure functions):
  - `birdyChip(card, alerts) -> {k: "stopped"|"changes"|"soon"|"check"|"done"|"none", n?, soon?}`, using the spec §2.2 table. `openLines` and `cardStatus` from the existing modules decide counts and states.
  - `zoneOf(cpl, targets) -> "grn"|"amb"|"red"|"gry"`. This reuses the existing zone logic: find it in `ReportClients.jsx` / `cpl.js` and move it here if it's private.
  - `moves(cards, targets) -> {better: string[], worse: string[]}`. It compares the zone of `previous_cpl` with that of `current_cpl`.
  - `summary(cards, alerts) -> {toDecide, stopped, soon}`.
  - `sheetRows({cards, monthRows, clientsInScope, latestByClient}) -> Row[]`, where
    `Row = {gid, name, leads, cpl, spend, zone, chip, cardId|null, readOnly, decided?}`.
- **`ReportPicker`** `{agentId, value: {run?: id, month?: "YYYY-MM"}, onPick}`:
  - It uses a DS `DropdownMenu`, with month section headers from the run dates and a "Whole months" section listing each distinct month among the loaded runs.
  - It keeps "Older reports" (`loadOlder`).
  - Labels come from `runLabel`, plus "· Today" when the run is the latest.
- **`SheetSummary`** `{view: "today"|"past"|"month", summary, moves, range, onToday}` renders exactly the spec §2.1 lines.
- **Page:**
  - `PageHeader` with `actions={<ReportPicker/>}`.
  - `SegmentedTabs`: Report, Lessons, Settings. `?tab=` is synced, and old `report` and `scoreboard` map to Report.
  - Panels stay mounted (`hidden` attribute).
  - `?month=` and `?run=` are mutually exclusive.
  - The existing empty, error and redirect states are kept.
  - The Report panel renders `<ClientSheet/>` (Task 12). Until that task, a placeholder `<div data-testid="sheet" />` is acceptable for this task's tests.

- [ ] **Step 1:** Write the failing tests:
  - `rows.test.js`: one test per chip row in the spec table, plus zones, moves and summary.
  - `page.test.jsx`:
    - `old tab=scoreboard lands on Report`
    - `summary shows N to decide and omits zero parts`
    - `picking a month sets ?month and shows Read-only line`
    - `draft agent shows Finish setup`
- [ ] **Step 2:** Run the tests and confirm they FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests and confirm they PASS.
- [ ] **Step 5:** Commit: `feat(stock): report frame with run and month picker`.

### Task 12: ClientSheet

**Files:**
- Create: `FE/src/components/agents/stock/sheet/ClientSheet.jsx`
- Test: `FE/src/components/agents/stock/sheet/__tests__/ClientSheet.test.jsx`

**Interfaces:**
- Consumes: `sheetRows`, `birdyChip` and `zoneOf` (Task 11), and the DS `DataTable`, `SegmentedTabs`, `SearchInput` and `Badge`.
- Produces:
  - `<ClientSheet rows view onOpen(row) />`, where `view` is `"today"|"past"|"month"`.
  - Behaviour per spec §2.2:
    - ordering modes, rank by header, top-3 highlight;
    - search from 10 rows up;
    - tucked no-figure rows;
    - the CPL chip tooltip;
    - Birdy chips, or "N decided" for past and month views.
  - A row whose `cardId` is null and that has no latest card isn't clickable: no `onRowClick` and a plain name cell.

- [ ] **Step 1:** Write the failing tests:
  - `most urgent puts clients to decide first then CPL rising then no figures`
  - `best to worst shows rank and ranks by clicked header`
  - `search hidden under 10 rows`
  - `no-figure rows tucked behind Show N row`
  - `no-figure client to decide stays visible`
  - `past view always ranked and shows N decided`
  - `opens latest card for client outside batch` (the row has `readOnly: true` and its `cardId` is that latest card)
  - `row without any card is not clickable`
- [ ] **Step 2:** Run the tests and confirm they FAIL.
- [ ] **Step 3:** Implement. Wire it into the page in place of the placeholder from Task 11. Handle `?client=` there: open once, then remove it with `router.replace`.
- [ ] **Step 4:** Run the tests and confirm they PASS.
- [ ] **Step 5:** Commit: `feat(stock): client sheet`.

### Task 13: ClientChatDialog

**Files:**
- Create: `FE/src/components/agents/stock/chat/opening.js`
- Create: `FE/src/components/agents/stock/chat/ClientChatDialog.jsx`
- Test: `FE/src/components/agents/stock/chat/__tests__/opening.test.js`, `.../ClientChatDialog.test.jsx`

**Interfaces:**
- Consumes:
  - `useCardChat` and `cardId` on `ChatConversation` (Task 9);
  - `actions.applyCard` and `revalidateStock`;
  - the `Line` result rendering and file upload from `CardPanel.jsx`. Export the `Line` component from there rather than copying it.
- Produces, in `opening.js` (pure):
  - `openingMessage(card, {alerts, readOnly}) -> {alert?: {headline, detail}, lines: [{n, verb, tone, ad, reason}], effect?: string, question?: string, pastNote?: string}`.
    - `verb` is "Remove", "Add" or "Turn back on".
    - `reason` is built from the line's spend, leads, CPL and flags, in the mock's wording style (for example "No leads on £27 spent").
    - `effect` reads "Yes to all N leaves M ads live" when `ads_live` is known.
  - `quickReplies(card, {alerts, hasTarget}) -> [{k: "yes_all"|"why"|"alert_q"|"draft"|"link"|"targets", label, href?, message?}]`. The labels are exactly spec §3.1.
- `<ClientChatDialog agentId card row alerts nextClient leftToDecide onClose onNext onSetTargets />`:
  - a DS `Dialog`, roughly 960px wide and 85vh tall;
  - the header with the figures row;
  - `ChatConversation` with `page="stock_card"`, `initialMessages` from the opening message (rendered as a custom first bubble with `BirdyAvatar`), `sessionKey`, `cardId` and `showScopePicker={false}`;
  - "Yes to all" calls `applyCard` and appends a local result bubble;
  - `renderAfterMessage` shows the `agent_changes` chips and calls `revalidateStock` when the turn changed something;
  - the footer has "N left to decide" and "Skip for now: X ›".

- [ ] **Step 1:** Write the failing tests:
  - `opening.test.js`:
    - `numbers lines with verbs and reasons`
    - `effect counts remaining live ads`
    - `billing alert headline first`
    - `read-only card has pastNote and no question`
    - `quick replies include Set targets only without target`
  - `ClientChatDialog.test.jsx`:
    - `yes to all calls applyCard and shows per-line results`
    - `failed line shows reason`
    - `revalidates on agent_changes`
    - `skip goes to next client`
    - `read-only card hides Yes to all`
- [ ] **Step 2:** Run the tests and confirm they FAIL.
- [ ] **Step 3:** Implement and wire it into the page: `ClientSheet.onOpen` opens the dialog, focus returns to the row on close, and `onSetTargets(gid)` switches to `?tab=settings&section=clients&client=gid`.
- [ ] **Step 4:** Run the tests and confirm they PASS.
- [ ] **Step 5:** Commit: `feat(stock): per-client Birdy chat dialog`.

### Task 14: Lessons tab and Teach Birdy

**Files:**
- Create: `FE/src/components/agents/stock/LessonsTab.jsx`
- Create: `FE/src/components/agents/stock/LessonSheet.jsx`
- Create: `FE/src/components/agents/stock/TeachBirdyDialog.jsx`
- Delete: `FE/src/components/agents/stock/LessonsList.jsx` (check nothing else imports it, then delete)
- Test: `FE/src/components/agents/stock/__tests__/LessonsTab.test.jsx`

**Interfaces:**
- Consumes: `useLessons` (now with `uses` and `last_used`), `keepLesson`, `overruleLesson`, `removeLesson`, and `nameOf(gid)`.
- Produces:
  - `sourceLabel(lesson, nameOf) -> string`: the spec §4.1 table, plus `chat_edit`, which gives "You changed it in chat".
  - `lessonIcon(lesson) -> LucideIcon`: remove/pause to `TriangleAlert`, revive to `RefreshCw`, money/target to `PoundSterling` (or the currency icon), weekday to `CalendarDays`, other to `BookOpen`. It picks from `kind`, `filter.weekdays` and keywords in the text.
  - `<LessonsTab agentId actions nameOf onOpenCard(runId, gid) />`.
  - `<LessonSheet lesson ... />`: the DS `Sheet` with Keep, Overrule and Remove, where Remove uses `confirm()` and an undo toast that re-adds the lesson through Keep. It shows the last uses as links.
  - `<TeachBirdyDialog agentId onChanged />`: a `Dialog` with `ChatConversation`, `page="stock_lessons"`, `agentId` and `sessionKey="stock_lessons:{agentId}"`.

- [ ] **Step 1:** Write the failing tests:
  - `header shows count and Teach Birdy`
  - `row shows scope source date text and used count`
  - `Not used yet when uses 0`
  - `overruled behind toggle`
  - `sheet remove confirms then calls removeLesson`
  - `sourceLabel maps every source`
- [ ] **Step 2:** Run the tests and confirm they FAIL.
- [ ] **Step 3:** Implement and wire it into the page's Lessons panel.
- [ ] **Step 4:** Run the tests and confirm they PASS.
- [ ] **Step 5:** Commit: `feat(stock): lessons tab with usage and Teach Birdy`.

### Task 15: Settings sub-tabs

**Files:**
- Modify: `FE/src/components/agents/stock/AgentSettings.jsx`
- Modify: `FE/src/components/agents/stock/SetupClients.jsx` (add `focusClient`)
- Test: `FE/src/components/agents/stock/__tests__/AgentSettings.test.jsx` (create)

**Interfaces:**
- Produces:
  - `<AgentSettings agent clients actions section onSection focusClient />`. The sections are `modes`, `schedule`, `clients`, `creative` and `slack`, with labels exactly as in spec §4.2.
  - `<SettingsStatus agent />`, exported for the page's tab bar. It renders the live, turned-off and draft variants.
  - `SetupClients` with `focusClient` scrolls that row into view and highlights it (`data-focused`) once.
  - `?section=` is synced by the page.

- [ ] **Step 1:** Write the failing tests:
  - `shows one section at a time`
  - `section param selects sub-tab`
  - `focusClient highlights row`
  - `status line live shows next check and Review setup`
  - `turned off shows TurnOn`
- [ ] **Step 2:** Run the tests and confirm they FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests and confirm they PASS.
- [ ] **Step 5:** Commit: `feat(stock): settings sub-tabs`.

### Task 16: Agent setup chat

**Files:**
- Create: `FE/src/components/agents/setup/steps.js`
- Create: `FE/src/components/agents/setup/SetupRail.jsx`
- Create: `FE/src/components/agents/setup/AgentSetupChat.jsx`
- Create: `FE/src/components/agents/setup/blocks/{PlaybookBlock,ClientsBlock,PermissionsBlock,ScheduleBlock,SlackBlock,PracticeBlock,PreviewBlock}.jsx`
- Modify: `FE/src/app/hub/agents/custom/new/page.jsx`
- Modify: `FE/src/app/hub/agents/custom/[id]/setup/page.jsx`
- Test: `FE/src/components/agents/setup/__tests__/*.test.jsx`, and update `custom/new` and `[id]/setup` page tests

**Interfaces:**
- Consumes:
  - `createAgent`, `patchAgent`, `activateAgent`, `useAgent`, `useAgentConfidence`, `startDryRun`/`pollJob`, `answerPractice`/`resolvePractice` (agents-api);
  - `ClientScopeTable`, `GuardrailsForm`, `PracticeCase`, `DryRunSummary`, `ConfidenceMeter`, `ClaimConflicts`;
  - transcript resume: setup has no card, so it resumes the way `TrainingChat` does today. Use `sessionKey="agent_setup:{id}"`, check `TrainingChat.jsx`, and use the identical persisted-session mechanism. The `HIDDEN_HISTORY_PAGES` filter (Task 4) only hides these sessions from the history list; `GET /api/chat/conversations/{sid}` still returns them.
- Produces:
  - In `steps.js`:
    - `SETUP_STEPS = [{key: "purpose", label: "What it does"}, {key: "playbook", label: "Its playbook"}, {key: "clients", label: "Clients"}, {key: "permissions", label: "What it can change"}, {key: "schedule", label: "Report time"}, {key: "slack", label: "Slack"}]`;
    - `currentStep(steps) -> key | null`;
    - `stepAnswer(agent, key) -> string | null`, the one-line summary per step: the description, "N rules", "N clients", a permissions summary, "07:00 Europe/London", "#channel".
  - `<SetupRail agent confidence onChange(key) onTurnOn />`, per spec §5.1. Below 1024px it collapses into a bar.
  - `<AgentSetupChat agentId? />`:
    - With no `agentId`, the first send calls `createAgent({type: "custom", name: "New agent"})`, then `router.replace(customSetupPath(id))`, then sends the message. On failure the text stays in the composer and an error toast shows.
    - Example jobs appear only before the first answer.
    - `renderAfterMessage` maps `agent_changes[].ui_block` to the blocks. Each block saves through the existing API, then calls `send(<short confirmation text>)`, for example `Picked ${n} clients`.
    - It revalidates `useAgent` and confidence after every turn with changes.
  - Both pages render `<AgentSetupChat/>` with the title "Set up your new agent".
- Remove `WizardSteps`, `ScopeStep` and `CheckStep` (and their tests) once nothing imports them. Keep `AgentTraining` and `TrainingChat`.

- [ ] **Step 1:** Write the failing tests:
  - `steps.test.js`: `currentStep picks first false`, `stepAnswer formats each step`.
  - `SetupRail.test.jsx`: `Turn on disabled until ready with unlock note`, `Change sends change message`, `n of 6 counts done steps`.
  - `AgentSetupChat.test.jsx`:
    - `first message creates agent then routes and sends`
    - `create failure keeps text`
    - `resumes existing draft without creating`
    - `example jobs hide after first answer`
    - `playbook ui_block renders PlaybookBlock with confirm buttons`
    - `clients block save patches agent and sends confirmation`
    - `claim conflict shows ClaimConflicts in block`
- [ ] **Step 2:** Run the tests and confirm they FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npx vitest run src/components/agents src/app/hub` and confirm it PASSES.
- [ ] **Step 5:** Commit: `feat(agents): chat-driven custom agent setup`.

## Phase D: Clean-up and verification

### Task 17: Remove dead code, then do full checks

**Files:**
- Delete the components and tests that nothing imports any more. Candidates: `MorningReport`, `ReportClients`, `FollowUps`, `Scoreboard.jsx` (both exports), `LearnedFrame` (keep `Lesson` if `LessonSheet` uses it), `WeeklyMessage`, `AlertsFrame`, `WizardSteps`.
  - For each, confirm with `grep -rn "<Name>" src` before deleting.
  - `CardPanel` stays only if `Line` is exported from it. Otherwise move `Line` to `chat/LineResult.jsx` and delete `CardPanel`.

- [ ] **Step 1:** Delete the dead files.
- [ ] **Step 2:** Run the checks:
  - FE: `npm run lint && npx vitest run && npm run build`.
  - BE: `pytest -q`.
  Expected: all green. Any failure is fixed in the owning task's files, then re-run.
- [ ] **Step 3: Verify locally.**
  - Start the BE locally.
  - Build the FE with `NEXT_PUBLIC_API_URL=http://localhost:8000` (otherwise it hits the deployed API).
  - Use a test user with a stock agent that has runs. The dev DB is shared, so clean up the test user's data afterwards.
  - Crawl and screenshot:
    - `/hub`;
    - the Media Buying Report (today, a past run, a month);
    - a client chat (Yes to all, a free-text question, save a lesson);
    - Lessons and its sheet;
    - each Settings sub-tab;
    - `/hub/agents/custom/new` through to Turn on.
  - Compare each screenshot with the ticket's 7 "after" images and fix any differences in the owning component.
- [ ] **Step 4:** Commit: `chore(hub): remove replaced report and wizard components`.
- [ ] **Step 5:** Push both branches and open two PRs (FE and BE). Each PR body links the ClickUp ticket and the other PR, lists the BE-first deploy order, and ends with:
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)`
