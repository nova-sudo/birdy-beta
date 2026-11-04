# Stock Media Agent: rulings and open differences

Decisions made during the build where the spec and plan left a choice. Each gives what was decided, why, and the cost if wrong.

## Rulings

- Task 4 repoints hub page and StartOverButton so the suite stays green, using the first custom agent until Task 17 rewrites the hub — plan left a gap between tasks — costs one small interim edit if wrong.
- Prepaid prefill lives in Task 6: run_alerts stores detected is_prepay_account on the client's settings when prepaid is unset — Task 5 can't read Meta yet — a wrong default is editable in setup.
- Task 14 replaces the agent_run binding with a table block before calling rt.validate and rt.render, and keeps the binding in the stored template — avoids changing report validation — costs little if wrong.
- Task 15 doesn't call users.info; decided_by uses the block_actions payload's user.name, falling back to <@id> — no users:read scope and no reconnect wanted — only affects display of a name.
- partial/null client zone override is an activation error naming the client, not a fallback to agency default — a prefilled green with no red must never silently act on a different limit — if wrong: agencies with a CPL target on file see one extra field to fill at setup.
- data window becomes an editable setting (spec §3 lists it as editable, §5 model omitted it); lose_max_leads kept; spec §5 amended for both — if wrong: two unused settings keys.
- prepaid spend reads account-level Meta insights once per account, not agent_ad_days — spec says account spend and shared accounts alert on both groups — if wrong: one extra Graph read per prepaid account per run.
- spend alerts are gated on history readiness and the history sync marker, never on the newest agent_ad_days row, since zero-spend days may write no row — if wrong: alerts stay silent until history is ready on a new account.
- ARCHIVED stays in meta_ad_state with _fetch_all shrinking the page limit on Graph's reduce-data error; real Graph load check goes to Task 21 — if wrong: refresh for large accounts stays slow or fails, affecting custom agents too.
- Task 9 must refresh meta state before the alerts phase (carry into Task 9 dispatch) — review found run_alerts statuses can be 24h old — if wrong: one extra refresh per run.
- Add candidates get no CPL ceiling; a poor source stays allowed and ranks last because spec says ranked only and AI chooses among allowed — if wrong: an ad far above its own green limit could be proposed to a red client; a one-line ratio check fixes it.
- video ads key by name even when a thumbnail hash exists; Meta shape unconfirmed, worst case a video re-posted under a new name isn't recognised as already run.
- bare numbers next to money words (cpl, cost, spend, budget, limit, target) count as money and must match facts; prompt requires a currency symbol — spec §6 says money figures must appear in facts — if wrong: some fine cards retry once or fall to the plain sentence.
- write_card gains last_card and open_questions keyword args, sent as delimited data; plan omitted them but spec §6 line 265 requires them; Task 9 supplies them — if wrong: slightly longer prompts.
- bare-number money check changes from a near-word blocklist to a shape match (money word + short linker + number, or any decimal near a money word); ids, dates and counted nouns never count — blocklist falsely rejected dates, "7-day" and "ad 3 of 4" — if wrong: an invented whole bare number phrased unusually can pass, though the prompt requires a symbol and symbolled figures are always checked.
- run starts on time; token check and health-only alerts run first, and urgent alerts post through an early hook (no-op until Task 15), while waiting for spend data is per client — a disabled account must not wait 2h for spend sync — if wrong: an agency sees alerts before its main report.
- a held client not marked Only flag gets an all-Flag card, per spec line 124 and claims.py — if wrong: after a Move the old agent keeps flagging that client until it's removed from its scope.
- stale is per client from that client's own refresh, not the whole run, overriding the plan — one queued client must not drop the agency's Auto to Ask — if wrong: Auto could act on a client whose refresh reports success but is old.
- prepaid_low moves to the urgent pass, since prepaid reads account-level insights and doesn't depend on history — if wrong: a little extra Graph read on time.
- account-scoped rate limits (80000, 80003, 80004, 80014, 17/2446079) defer only that account's clients; app/user limits (4, 17, 32, 613) stop the agent's tick — one throttled account must not block a whole agency for 24h — if wrong: more failed Graph calls to an already throttled user.
- urgent hook fires at the end of every alerts pass, after the spend stage for critical spend alerts, and in _end_incomplete, at-least-once by alert key — if wrong: one alert can repeat after a kill.
- shared account read once per tick rather than per run accepted — if wrong: one extra account read when a deadline lands mid-account.
- live check reads each target ad's ad set from Meta before every write, and a read failure refuses — plan's doc shape made it a no-op, spec requires it — if wrong: one extra Graph read per write, and Meta outages block writes.
- one short Mongo lease per agent around guardrail check plus write; a contended line queues for the cron — repro left an ad set with 0 live ads — if wrong: Apply on many lines is slower and some wait up to a minute.
- mode is re-resolved at write time for Auto and Ask; a line whose mode now resolves to Flag never writes — settings are the authority — if wrong: a buyer clicking Apply on an older card sees it become Flag.
- Undo is allowed when the agent is off and no other agent holds the client, refused when another agent holds it; Undo skips pause cap and max_ads_live but keeps last_live_ad — a buyer who turns an agent off in alarm must be able to reverse its change; spec §4 targets moved clients — if wrong: an agent that's off can still make one reversing write per undo.
- max_ads_live is per ad set as spec §3 says, in turn-on check, validate_draft and facts — client-wide wrongly limited multi-ad-set clients — if wrong: a client with several ad sets can run more ads in total than an agency expects.
- client-name check covers Add lines only with a 3-character minimum per spec §6 — common short names flagged every card into Ask forever — if wrong: a 2-letter client name on another client's ad isn't flagged.
- protected tags and taught exceptions check only the target ad's live name; a protected neighbour doesn't block changing another ad — otherwise any ad set holding an Evergreen ad could never have a Remove — if wrong: an ad beside a protected one can be paused.
- write lease keyed on agent plus client, replacing per-agent — all guarded limits are client or ad set scoped, and one client's queue starved another's Undo — if wrong: none known, as nothing here is agency-wide.
- mirror's "off" overrides Meta's "live" only if that mirror row was written in the last 5 minutes; otherwise trust Meta — a buyer following Birdy's advice to turn on a spare was refused — if wrong: a read lagging over 5 minutes after a write could pause an ad set's last live ad.
- held video files are keyed by source ad account plus source video id, not by normalised name, overriding the plan's (user_id, creative_key) — name matching posted one client's video for another with no person involved on Auto — if wrong: the same video reused from a different account needs a second upload.
- managed Add re-checks limit, agent status, on_hold, acting agent, mode and superseded at go-live under the lease; a failed re-check leaves the ad paused with a reason and Retry available — spec line 257 and a video can take an hour — if wrong: one extra Graph read per go-live.
- image files are keyed by image hash, else source ad id; empty primary text blocks every format and empty headline blocks image ads to a lead form or WhatsApp, as Meta's reference requires neither — if wrong: a valid text-only ad is refused with a reason.
- adoption by creative id is unconditional; adoption by name needs PAUSED and created after the create attempt started — an unrequested write to the wrong ad must not be possible on a name match — if wrong: a rare lost reply leaves a harmless second paused ad.
- ads whose text Birdy can't read (asset_feed_spec and similar) aren't offered as Add candidates and aren't copied — an unpostable ad used an Auto slot on every card; copying the first asset_feed body would change the ad — if wrong: dynamic-creative winners are never Added by Birdy, and a person posts them by hand.
- a wrong result can be cleared through POST /outcomes/{id}/clear, and after the data wait a row with no data ends unscored rather than never_went_live or lost — spec is silent, and two false losts remove a creative for the agency — if wrong: one small route nobody uses.
- a row unjudgeable for 14 days ends with result "unscored" and stops being read — if wrong: a client whose zones are set after 14 days doesn't score that ad.
- an unsynced row is never scored on partial data; it waits, then ends unscored at 14 days — missing leads inflate CPL and two false losts remove a creative — if wrong: a client with long history outages gets no results for that period.
- spec §3's Lost has no minimum leads, so a 1-lead ad at CPL over 1.3x is lost, as written — if wrong: thin evidence removes a creative after two such ads; Clear reverses it, and a minimum-leads check is a small change.
- escape only mrkdwn fields, matching Reports, since plain-text and raw-text fields can't ping; verified in a real channel at Task 21 — if wrong: a literal & or < in a header renders oddly or Slack rejects the message.
- leave agent placeholders allowed in saved markdown blocks, matching Reports — only an agency's own admin can write such a template, and Slack's parsing there is unverified, so check at Task 21 and refuse them in validate_template if it pings — if wrong: an ad name containing <!channel> pings that agency's channel. Final-review carry: Task 15 must not pass chart groups with unescaped labels.
- Slack's Apply all acts only on cards already posted to Slack — people can only approve what they saw — if wrong: a card waits for its post before Apply all reaches it.
- a failed Slack publish no longer ties up the run: the run finishes, the report stays on the dashboard, and posting retries slowly for 24 hours or until reconnect, marked late — Auto may already have changed ads, so the report must reach people — if wrong: an old report posts late, labelled as such.
- an unclear @Birdy mention in a multi-client thread records nothing and asks which client, instead of defaulting to agency-wide; names match whole-word, longest first, and short names match exact case — a wrong-client lesson changes live decisions — if wrong: one extra reply for the person.
- lessons from Slack mentions can only make ad-name filters scoped to one client; with no client they are kept as a note — anyone in the channel can write these, and a filter refuses ads on Apply and Auto — if wrong: an agency-wide filter must be set from the dashboard.
- refuse button presses where user.team_id differs from the connected team, so Slack Connect guests can't change ads — they aren't in the agency — if wrong: a legitimate shared-channel user must use the dashboard.
- socket-level guard in tests/conftest.py blocking outbound calls except for the `live` marker, with one full run under it — the real env is loaded and the review found 2 real OpenAI calls per run of test_stock_apply.py — if wrong: pre-existing tests needing the network must be named in an allowlist.
- park M6 (client timeout on an accepted post can repeat a message) and M9 (out-of-order chat.update) — no idempotency key exists on chat.postMessage, and the next write corrects M9 — if wrong: a rare duplicate message or briefly stale card.
- a Slack Connect guest's @Birdy in a card thread is refused and records no lesson: refuse when user_team (else team) differs from the connected team, and when both are absent in an externally shared channel; it never falls through to chat — anyone from another organisation otherwise shapes live decisions — if wrong: a colleague in a shared channel must use the dashboard.
- leave three pre-existing gaps unchanged on this branch and tell the user at the end: guest @Birdy outside a card thread runs chat as the agency (routers/slack_events.py:87-130); suggestion buttons have no user.team_id check though they change Meta (routers/slack_interactions.py:238-246); get_user_id_by_team_id(None) matches any user without the field (services/slack_bot_service.py:47,164-171) — they predate this work and changing chat for shared channels is the user's call — if wrong: the gaps stay open until the user decides.
- raise the stored-press cap to 5 s so one line fits its 4 s estimate; a tick with presses starts fewer Meta lines — presses are rare and a person is waiting — if wrong: Meta lines wait one more tick in heavy minutes.
- accept the small gap between the fence read and the socket for now; Task 21 checks deferred work on Vercel and removes `defer` if it doesn't run reliably — closing it fully needs that removal — if wrong: a rare undo reaches Meta just after the person was told it failed, and the line state shows it.
- a Slack-mention name filter that matches the client's own name becomes a note — "leave Acme alone" otherwise refuses all Acme's ads, which N4 set out to stop — if wrong: a person whose ad names genuinely use the client name sets that filter on the dashboard. Goes in the next Task 15 round.
- leave the allowlisted pre-existing tests making real calls (5 tests read dev Mongo, test_suggestion_flow pays OpenAI) and tell the user at the end — outside this feature, and the guard now stops new ones — if wrong: those tests keep costing a little on each full run.
- park re-review 3's minors M1-M5 for the final review — none writes to Meta and each ends in a true or correctable state — if wrong: a stale note on a card or a dismissed card after a very rare freeze. Final-review carry also: `_undo_write` cut marks "nothing changed" while the row refunds; a real result killed before storing past limits says "didn't happen" on an undone line; slack.py size.
- the weekly uses one agency week: dates from the agency timezone, applied to each client's account-local daily rows; a client whose last day hasn't ended is reported with a note — one label must match all rows and dropping those clients hides real results; spec §6's account timezone still decides which day a row belongs to — if wrong: a client far behind the agency is slightly undercounted, flagged in the report.
- Status Check reads last week's stored weekly; with none, it says this is the first week and compares nothing — the playbook compares against last week's message — if wrong: first report has no status comparison.
- an unposted weekly is rebuilt before posting and a failed build retries on later ticks; auto_post doesn't wait for late clients, which show as not judged — a lost weekly is worse than a partial one — if wrong: an auto-posted report lists a late client as not judged.
- add a cheap open-card count to the backend's latest-run response and have the badge use only that — the full run view builds scoreboard, learned and proposals on every tab focus on every page — if wrong: one small extra backend field.
- Task 18's stock schedule picker excludes times that never come due near midnight, and the custom agent picker is left alone — avoids a report that silently never runs — if wrong: an agency can't pick the last minutes of the day.
- the stock agent's API view serves add_writes_enabled at the top level — the brief promises it and without it Add is stuck on Flag — if wrong: one extra read-only boolean.
- a preview where every client failed doesn't count as finished, on server and UI — turning on an agent that read no data defeats the preview — if wrong: an agency with a temporary outage retries the preview.
- schedule picker stops at 23:30 — a delayed tick past midnight skips the day at 23:45 — if wrong: the last half hour isn't selectable.
- the template `notice` display goes in Task 20's settings page, not Task 19 — that's where template settings live — if wrong: none, just placement.
- a superseded card hides Apply, Edit and Dismiss but keeps Undo where the server says the line can be undone, departing from the brief's "no actions" — a person must be able to reverse a live ad — if wrong: an extra Undo button on an old card.
- Apply all is disabled with a reason until the run finishes; single-card Apply still works — it otherwise applies cards the person hasn't read — if wrong: a run waiting on data delays bulk approval only.
- backend cards carry leads and ads_live, matching the mock; older cards show a dash — people need them to judge the change — if wrong: two extra stored fields.
- the backend sends has_newer on cards, so the UI hides Retry and Upload that would 409 on past reports — if wrong: one extra field per card.
- add POST /agents/{id}/deactivate for stock agents only: status back to draft plus a `turned_off_at` mark, leaving scope, settings, runs, cards and lines alone; the hub and Settings show Turned off with Turn on, never Start over, and Turn on calls /activate directly — the spec didn't provide a route, and a plain draft would offer Start over, which deletes everything — if wrong: custom agents still can't be turned off, and an in-progress run may resume after turn-on within 24 hours.
- agent templates refuse report placeholders and metric blocks such as {{spend}} instead of letting them work as spec §8 says — agent sends carry no report data, so they'd preview with sample figures and post blank, and fetching it would break the tick's time budget — if wrong: the feature is narrower, and adding report data to agent messages later is its own piece of work.
- Task 21 runs the backend against an isolated database, never the shared `birdyaidev`, departing from the brief's throwaway-user setup — startup runs create_agent_indexes, whose migration would rewrite real agents and indexes the deployed backend uses — if wrong: a few minutes more setup.
- real Meta, Slack and Blob carries go into the launch doc as exact steps instead of being run at Task 21 — they write to real accounts and need the user's say-so, and spec §15 says they need real accounts — if wrong: those risks stay open until the user runs them.
- migrate_claims runs once per agent, marked on the agent, and the launch doc gets an explicit scripts.ensure_indexes step between backend and frontend deploys, with verification queries — the nightly pass would hand moved clients back, and Vercel skips startup migration — if wrong: one extra field per agent and one manual deploy step.
- the create route accepts no body as a custom agent during the deploy window — an old frontend otherwise gets 422 for new agencies — if wrong: an agent created with no type becomes custom.
- fix I4 and the launch doc minors in one last small round, checked by the controller, with no further review loop — I4 leaves agencies stuck with a false message, and it fails safe so a small fix carries little risk — if wrong: a small UI bug is caught at launch checks.

## Differences from the mock left for a decision


**Screen 1, hub**
- Icons instead of coloured dots.
- "zero spend days" instead of "£0 days".
- Custom row reads "Live · 1 client" with no waiting count (documented decision).
- Open is a link rather than a ghost button.
- Pause icon for zones.

**Screen 2 A, setup**
- Horizontal stepper at the top rather than the left step rail. At 390 it collapses to numbers.
- No top "Set up your Media Buying Agent / Save and exit". There's Start over and a BirdyHub back link, and each step has its own heading.
- Prepaid is a toggle rather than a Yes/No badge.
- Batch default per row, "Default" in inputs with a currency prefix.
- Added: watched checkbox column, currency select.

**Screen 3 A, report**
- "Apply 2 changes" instead of "Apply 2 cards".
- No "Clean: ..." row when alerts exist, only when there are none.
- Velvet also has Dismiss, and each card has an extra chevron.
- Bars are grouped per currency, with "Each currency is scaled on its own".
- Bar labels truncate at 390 ("Harbour Body ...").
- "Ask me is on" description shows only when all ask.
- Added: report picker, tabs, page header, severity badges.
- Bars: one extreme value squashes the others (seen with the seeded £98,765). Not in the mock, and unlikely in practice.

**Screen 5, settings**
- Mock has one combined table with a segmented control per override and "+ Override for a client". Built: "For every client" (segmented) plus "Different for one client" (selects listing every client).
- Mock has "What each mode means" and Lessons frames. Built: inline definitions, and Lessons as its own tab.
- Live badge beside "Changes here apply", and Turn off.
- Sections have mixed widths (Clients is wide, others are narrow).
- Many more sections than the mock.

**App shell at 390, not from this branch**
- The top bar pushes search, bell and account off-screen on long titles and on BirdyHub. `src/app/layout.jsx` is unchanged from origin/main and BirdyHub's subtitle already exists there, so this is app-wide. Not fixed.

