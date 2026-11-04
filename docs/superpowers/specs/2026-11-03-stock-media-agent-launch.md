# Stock media-buying agent: launch checks

These checks need real accounts, so they weren't run during the build. Nothing here has passed yet. Tick
each one as it's done and write the result next to it.

The four checks from spec section 15 are marked **[§15.1]** to **[§15.4]**. The rest are the items the
build set aside for a real account.

## Rules for running these

- **Meta writes happen on a test account only.** Use an ad account with no client spend, and put every
  test ad in a campaign you've paused, so nothing can deliver even if an ad turns on.
- **Slack checks use a test channel**, except where a check needs a Slack Connect channel or a Grid install.
- **Reads on real client accounts are fine.** Every step that may touch one says so.
- Use a throwaway agency login. Delete its agent, cards and posts when you finish.

## Deploy order

1. **Deploy the backend first, then the frontend.** The Creatives upload now uses `path_prefix` from
   `POST /api/creatives/upload-grant`. A new frontend on the old backend makes every Creatives upload fail.
2. The backend runs `create_agent_indexes` on startup. It moves old `media_buying` agents to custom agents
   and replaces the old agent index. It ran cleanly on a local Mongo with seeded old agents, but not on
   production data, so take a snapshot first if the backup schedule doesn't cover it.
3. **`AGENT_ADD_WRITES_ENABLED` stays off in production until check M1 passes.** With it off, Add can only
   be Flag. Set it on a separate backend for M1. The values that turn it on are `1`, `true`, `yes` and `on`.
4. After the deploy, confirm the crons in `vercel.json` are registered: `/api/cron/agents-tick` every
   15 minutes, `/api/cron/agents-outcomes` daily, `/api/cron/creatives-tick` as already scheduled.

For the read-only commands below, set these in your shell. Don't paste the token into notes.

```sh
export G=https://graph.facebook.com/v25.0
export T=<a token that can read the account>
export ACT=act_<account id>
```

## Meta

### M1. Post one paused image and one paused video [§15.1]

Creatives posting has never run on real Meta. This check decides whether `AGENT_ADD_WRITES_ENABLED` can
be turned on.

1. Run a backend that only you use, with its own database and `AGENT_ADD_WRITES_ENABLED=1`. Never set the
   flag on the production backend for this.
2. Connect the test ad account. In it, make a paused campaign with one paused ad set.
3. Set up the stock agent with two clients on test accounts: the source holds a winning image ad and a
   winning video ad, and the destination holds the paused ad set. Set Add to Ask me.
4. Apply one Add card line for the image, and one for the video.
5. Before the ads turn on, read their status: `curl "$G/<ad id>?fields=status,effective_status,creative{id}&access_token=$T"`.
6. Wait for `creatives-tick` and `sync_add_lines` to finish, then read the same fields again.

**Pass:** both ads exist with the expected name, text, headline, call to action and media. `status` is
`PAUSED` when first read, and the Birdy line ends as `applied`. `effective_status` stays non-delivering
because the campaign is paused. The ads show in Ads Manager with no errors.

**If it fails:** leave the flag off. Add stays Flag only, and nothing else in the agent depends on it.

### M2. Video `source` access [§15.2]

Read only, safe on real accounts. It tells us how often people will see `needs_file`.

1. Pick at least 20 active video ads across three or more real accounts.
2. For each ad, read the video id: `curl "$G/<ad id>?fields=creative{video_id,object_story_spec}&access_token=$T"`.
3. Read the source: `curl "$G/<video id>?fields=source&access_token=$T"`. Use a token from a different
   account in the same business for at least five of them, to cover a read from another account.

**Pass:** record the share of videos with a non-empty `source`, split by same-account and cross-account.
There's no fixed bar. It passes if you accept that the remainder asks people to upload the file. Write the
number here: ____

### M3. Prepaid balance against the top-up estimate [§15.3]

Read only, on a real prepaid account.

1. Read `curl "$G/$ACT?fields=is_prepay_account,balance,amount_spent,funding_source_details,currency&access_token=$T"`.
2. Enter the latest top-up in the client's Prepaid settings in Birdy.
3. Compare Birdy's "About N days left" with what Meta's billing page shows as remaining funds.

**Pass:** the estimate is within one day of spend of Meta's remaining funds. Note what `balance` holds on
this account. Meta documents it as the amount due, so the estimate must not read it as funds remaining. If
`is_prepay_account` is wrong on a known prepaid account, record that too, because the alert relies on it.

### M4. `/ads` with creative expansion and the ARCHIVED filter

Read only. Run it on the largest real account. This one also protects live custom agents, since their
refresh uses the same read.

1. Time the call that `ai/agents/meta_state.py` makes, using `_AD_FIELDS` and its status filter:
   `curl -w "\n%{time_total}\n" -g "$G/$ACT/ads?limit=200&fields=id,name,effective_status,creative{id,image_hash,video_id,body,title,object_story_spec}&effective_status=[\"ACTIVE\",\"PAUSED\",\"ARCHIVED\"]&access_token=$T"`.
2. If Meta answers "Please reduce the amount of data", repeat with `limit=50`, then `limit=25`.
3. In a backend pointed at that account, run a custom agent refresh and read its log.

**Pass:** the refresh finishes. Archived ads are in the result. Any reduce-data reply makes `_fetch_all`
shrink the page and carry on, with no failed refresh.

**If it fails:** a large account's refresh is slow or fails, and custom agents are affected too, so fix this
before the frontend deploy.

### M5. Rate-limit codes and header parsing

1. Search recent backend logs for `MetaRateLimit`. If nothing shows up, trigger a limit by running repeated
   reads on the test account until Meta answers with code 17, 4 or 80000 to 80014.
2. Record the error body and the `X-Business-Use-Case-Usage` header.

**Pass:** `is_rate_limit` is true for that body, the scope is right (account or app), and
`estimated_time_to_regain_access` is read in minutes.

### M6. Live-read budgets

The Apply path allows 2.5 seconds for Slack and 10 seconds on the page.

1. On a backend pointed at the test account, press Apply on one line from the page, then from Slack.
2. Time the Graph calls in the backend log, then press Apply all on a card with five or more lines.

**Pass:** one Apply from Slack answers inside 2.5 seconds, and Apply all from the page answers inside
10 seconds. Lines that didn't finish are queued, and none are lost.

### M7. Add details on the test account

Do these together with M1.

| What to check | How | Pass |
| --- | --- | --- |
| `file_url` from fbcdn | Post from a source whose creative only has an fbcdn image URL | The image uploads, or the line ends `needs_file` with a clear reason |
| `/adimages` URL read | `curl -g "$G/$ACT/adimages?hashes=[\"<hash>\"]&fields=url&access_token=$T"` | `url` comes back |
| Cross-account source read | Read the source creative with the destination's token | It reads, or the line ends `needs_file` |
| Call to action on lead forms | Post into an ad set with a lead form | The form is attached, and the call to action is valid |
| Blank-text ads | Use a source ad with no body or no headline | The line refuses with reason `no_words`, and nothing is posted |
| Which creative shapes have no body | Read `body` and `object_story_spec` across about 20 real ads (read only) | Record the shapes, and check `no_words` isn't firing on normal ads |
| `/{adset}/ads` lists paused ads | `curl "$G/<adset id>/ads?fields=id,status,effective_status&access_token=$T"` after M1 | The paused M1 ads are listed |
| Ad `creative{id}` equals the id passed | Compare the id on the post job with the ad's `creative{id}` | They match |
| Read-after-write lag | Read `/{ad id}` straight after a Remove and a Revive on a test ad | The new status shows inside the time the line waits. Record the lag |

## Slack

Install the Slack app on a test workspace, with a test channel set in the agent's Settings.

### S1. Table block [§15.4]

1. Let a full report run on the test account with the channel set, so the daily summary posts.
2. Open the daily summary in Slack on desktop and on a phone.

**Pass:** the client table shows with its headers, values and zone dots. If the table is too wide, it stays
readable. Slack accepts the message with no `invalid_blocks` in the backend log.

### S2. Special characters and pings

| What to check | How | Pass |
| --- | --- | --- |
| `&` in `plain_text` headers | Name a client `A & B <test>`, then post a card | The header shows `A & B <test>`, not `&amp;` |
| `<!channel>` in a `markdown` block | Name a test ad `<!channel>`, and add a `markdown` block with that placeholder to a template | **No one gets pinged.** If it pings, refuse report placeholders in `markdown` blocks in `validate_template` before launch |
| `_cut` keeps entities whole | Use a name over the length limit, with `&` near the cut, on a stock card and on a live Report | No broken `&am` at the end, on either surface |

### S3. Buttons and updates on Vercel

Run these against a deployed backend, because the behaviour depends on the Vercel runtime.

1. **Ack first:** press Apply, and check the backend log for the time to the 200.
   **Pass:** Slack shows no "operation timed out" warning.
2. **`multi_static_select`:** on a card with several lines, pick some lines and press Apply.
   **Pass:** only those lines are applied.
3. **`chat.update` with `blocks=[]`:** let a newer card replace an older one.
   **Pass:** the old message updates, with its text and no stale buttons.
4. **Ephemeral notes:** press a button that's refused, for example on a card already applied.
   **Pass:** only you see the note.

### S4. Who can press, and who is learned from

1. **Slack Connect:** have a member of another workspace in a shared channel press Apply.
   **Pass:** the press is refused, and `user.team_id` in the payload is theirs.
2. **Same-org member:** press as a normal member. **Pass:** `user.team_id` matches the install and it works.
3. **Grid install:** install on an Enterprise Grid org, if one is available. The payload's team may be null.
   **Pass:** the press fails closed with no write. Known issue: the edit form then shows the wrong error,
   so fix that or accept it here.
4. **`app_mention` in a shared channel:** mention the bot in a thread under a card, from your workspace,
   then from the other one. Capture both payloads. **Pass:** only the first becomes a lesson.

### S5. Apply all and cron throughput

The tick was calculated to get through about 3 to 5 lines, shared by all agencies. It hasn't been measured.

1. On the test workspace, press Apply all on a report with at least 10 queued lines.
2. Read how many lines finish per `agents-tick`, using the `applied` timestamps on those lines.

**Pass:** the number is recorded here: ____, and every line finishes within the wait you'd accept, with
every line queued from Slack shown as in progress meanwhile.

## Vercel

### V1. Deferred work after the response

`routers/slack_interactions.py` passes `_finish_stock_action` to `background_tasks`.

1. On the deployed backend, press Apply on 10 lines, one at a time, from Slack.
2. For each one, read how long the line took to change state.

**Pass:** all 10 finish right after the press, without waiting for the next cron tick.

**If it fails:** remove `defer` so lines wait for the tick. Removing it also closes the small gap between the
fence read and the socket, where an undo could reach Meta just after the person was told it failed.

### V2. Cron tick timing

1. Read the Vercel logs for `/api/cron/agents-tick` and `/api/cron/agents-outcomes` for a day after launch.
2. Confirm that a call without the `CRON_SECRET` bearer is refused.

**Pass:** no timeouts, a 401 or 403 without the secret, and the morning run starts at the first tick after
the agent's time.

## Blob

### B1. Uploads and the file route

Run these on a preview deployment with the backend deployed first.

1. **Creatives upload:** upload an image and a video in Creatives. **Pass:** both work, and the stored path
   starts with `path_prefix` from the grant.
2. **Own-blob check:** read the stored URL's host. **Pass:** it ends with `.public.blob.vercel-storage.com`,
   and `is_own_blob_url` accepts it.
3. **`read_media_kind`:** on a line in `needs_file`, attach a real JPEG, then an MP4, then a text file renamed
   `.mp4`. **Pass:** the first two are accepted, and the third is refused for its real type, from the bytes.
4. **Timeout:** `read_media_kind` allows 5 seconds. Try a video of about 1 GB. **Pass:** it's accepted, with no timeout in the log.

## Sign-off

| Check | Result | Date | Who |
| --- | --- | --- | --- |
| M1 Paused image and video [§15.1] | | | |
| M2 Video source [§15.2] | | | |
| M3 Prepaid [§15.3] | | | |
| M4 `/ads` read | | | |
| M5 Rate limits | | | |
| M6 Live-read budgets | | | |
| M7 Add details | | | |
| S1 Table block [§15.4] | | | |
| S2 Special characters and pings | | | |
| S3 Buttons on Vercel | | | |
| S4 Who can press | | | |
| S5 Throughput | | | |
| V1 Deferred work | | | |
| V2 Cron | | | |
| B1 Uploads | | | |

Turn on `AGENT_ADD_WRITES_ENABLED` in production only after M1 and the M7 rows pass.
