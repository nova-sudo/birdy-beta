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
   Confirm it before and after the deploy: in the backend's Vercel project, run `vercel env ls production` and
   check the name isn't listed. Then open Settings on a production agent. **Pass:** Add shows Flag selected,
   Ask me and Auto are disabled, and the note says posting new ads is switched off.
4. After the deploy, confirm the crons in the backend repo's `vercel.json` are registered: `/api/cron/agents-tick` every
   15 minutes, `/api/cron/agents-outcomes` daily, `/api/cron/creatives-tick` as already scheduled.

For the read-only commands below, keep the token out of your shell history and out of URLs. Read it without
echoing it, and send it as a header, which the Graph API accepts:

```sh
export G=https://graph.facebook.com/v25.0
export ACT=act_<account id>
read -rs T && printf 'Authorization: Bearer %s\n' "$T" > "${TMPDIR}meta-auth" && chmod 600 "${TMPDIR}meta-auth"; unset T
# Every command below passes it with:  -H @"${TMPDIR}meta-auth"
```

Delete the file when you finish: `rm "${TMPDIR}meta-auth"`. Don't paste the token into notes.

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
5. As soon as each ad id appears on the line, read it: `curl -g -H @"${TMPDIR}meta-auth" "$G/<ad id>?fields=status,effective_status,creative{id}"`.
6. Wait for `creatives-tick` and `sync_add_lines` to finish, then read the same fields again.

**Pass:** both ads exist with the expected name, text, headline, call to action and media, the Birdy line
ends as `applied`, and the ads show in Ads Manager with no errors. Judge delivery on `effective_status`,
which must be `CAMPAIGN_PAUSED` or `ADSET_PAUSED` at every read, so nothing delivers. `status` can be either
`PAUSED` or `ACTIVE`: the pipeline makes the ad paused, then turns it on, so the read depends on timing.

**If it fails:** leave the flag off. Add stays Flag only, and nothing else in the agent depends on it.

### M2. Video `source` access [§15.2]

Read only, safe on real accounts. It tells us how often people will see `needs_file`.

1. Pick at least 20 active video ads across three or more real accounts.
2. For each ad, read the video id: `curl -g -H @"${TMPDIR}meta-auth" "$G/<ad id>?fields=creative{video_id,object_story_spec}"`.
3. Read the source: `curl -H @"${TMPDIR}meta-auth" "$G/<video id>?fields=source"`. Use a token from a different
   account in the same business for at least five of them, to cover a read from another account.

**Pass:** record the share of videos with a non-empty `source`, split by same-account and cross-account.
There's no fixed bar. It passes if you accept that the remainder asks people to upload the file. Write the
number here: ____

### M3. Prepaid balance against the top-up estimate [§15.3]

Read only, on a real prepaid account.

1. Read `curl -H @"${TMPDIR}meta-auth" "$G/$ACT?fields=is_prepay_account,balance,amount_spent,funding_source_details,currency"`.
2. Enter the latest top-up in the client's Prepaid settings in Birdy.
3. Compare Birdy's "About N days left" with what Meta's billing page shows as remaining funds.

**Pass:** the estimate is within one day of spend of Meta's remaining funds. Note what `balance` holds on
this account. Meta documents it as the amount due, so the estimate must not read it as funds remaining. If
`is_prepay_account` is wrong on a known prepaid account, record that too, because the alert relies on it.

### M4. `/ads` with creative expansion and the ARCHIVED filter

Read only. Run it on the largest real account. This one also protects live custom agents, since their
refresh uses the same read.

1. Time the same call `ai/agents/meta_state.py` makes, with the exact `_AD_FIELDS` and `_AD_STATUSES`. The limit
   is the page size `_fetch_all` starts from, so check it's still 200:

   ```sh
   F='id,name,adset_id,campaign_id,effective_status,created_time,issues_info,ad_review_feedback,creative{id,image_hash,video_id,body,title,object_story_spec}'
   S='["ACTIVE","PAUSED","PENDING_REVIEW","DISAPPROVED","PREAPPROVED","PENDING_BILLING_INFO","CAMPAIGN_PAUSED","ARCHIVED","ADSET_PAUSED","IN_PROCESS","WITH_ISSUES"]'
   curl -sS -G -H @"${TMPDIR}meta-auth" -o /dev/null -w '%{http_code} %{time_total}s\n' \
     --data-urlencode "fields=$F" --data-urlencode "effective_status=$S" --data-urlencode 'limit=200' "$G/$ACT/ads"
   ```

   If those lists have changed in `meta_state.py` since this doc was written, use the ones in the code.
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
| `/adimages` URL read | `curl -g -H @"${TMPDIR}meta-auth" "$G/$ACT/adimages?hashes=[\"<hash>\"]&fields=url"` | `url` comes back |
| Cross-account source read | Read the source creative with the destination's token | It reads, or the line ends `needs_file` |
| Call to action on lead forms | Post into an ad set with a lead form | The form is attached, and the call to action is valid |
| Blank-text ads | Use a source ad with no body or no headline | The line refuses with reason `no_words`, and nothing is posted |
| Which creative shapes have no body | Read `body` and `object_story_spec` across about 20 real ads (read only) | Record the shapes, and check `no_words` isn't firing on normal ads |
| `/{adset}/ads` lists paused ads | `curl -H @"${TMPDIR}meta-auth" "$G/<adset id>/ads?fields=id,status,effective_status"` after M1 | The paused M1 ads are listed |
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
| `<!channel>` in a `markdown` block | Name a test ad `<!channel>`, and add a `markdown` block with that placeholder to a template | Have a second test user in the channel, with notifications on, watching their Activity tab. **Pass: they get no notification and the text shows literally, with no highlighted @channel.** If it pings, refuse report placeholders in `markdown` blocks in `validate_template` before launch |
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

**Pass:** all 10 lines finish within 3 ticks (45 minutes), with each line shown as in progress until then.
Record the lines per tick here: ____. If it's slower, either accept the wait in writing here or fix the
throughput before launch.

## Vercel

### V1. Deferred work after the response

`routers/slack_interactions.py` passes `_finish_stock_action` to `background_tasks`.

1. On the deployed backend, press Apply on 10 lines, one at a time, from Slack.
2. For each one, read how long the line took to change state: the time of the press in the Vercel log, against
   the line's `updated_at`.

**Pass:** all 10 change state within 30 seconds of the press, and none of those changes lines up with an
`agents-tick` run in the log.

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

## Open items from the build

Neither of these needs a real account. Both were left open by the local check.

### O1. Rerun the stock test files on real Mongo

An extra run of these files on a local real Mongo had failures, and ended before pytest named them. They are
unexplained. They might come from the harness (event loop clashes under `TestClient`, Mongo cutting dates to
milliseconds), or be real bugs that mongomock hides, so settle this before launch.

The plugin wasn't committed, so make it again. Use a local throwaway Mongo. **Never point this at
`birdyaidev` or any shared database, because it drops its database.** With Docker running:

```sh
docker run -d --name birdy-stock-rerun -p 127.0.0.1:27118:27017 mongo:7 --replSet rs0
docker exec birdy-stock-rerun mongosh --quiet --eval 'rs.initiate()'
mkdir -p /tmp/stock-rerun && cat > /tmp/stock-rerun/realmongo_plugin.py <<'PY'
"""Run the agent tests on a local real Mongo instead of mongomock. Loaded with -p, before conftest."""
import os
assert os.environ["MONGODB_DB"] == "birdy_stock_carries" and "27118" in os.environ["MONGODB_URI"]
import mongomock_motor
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient
_sync = MongoClient(os.environ["MONGODB_URI"])
def factory(*a, **k):
    _sync.drop_database("birdy_stock_carries")
    return AsyncIOMotorClient(os.environ["MONGODB_URI"])
mongomock_motor.AsyncMongoMockClient = factory
PY
# From the backend repo. Run the env file first, then override the database.
set -a; source .env; set +a
export MONGODB_URI='mongodb://127.0.0.1:27118/?directConnection=true' MONGODB_DB=birdy_stock_carries
PYTHONPATH=/tmp/stock-rerun python -m pytest -p realmongo_plugin -q -rf -p no:cacheprovider \
  tests/test_stock_runner.py tests/test_stock_apply.py tests/test_stock_add.py \
  tests/test_stock_lessons.py tests/test_stock_scoreboard.py tests/test_stock_weekly.py
docker rm -f birdy-stock-rerun
```

Check those test file names against `tests/` first, since the run covered these areas by file. Router tests
through `TestClient` fail on this plugin with "different loop", so leave those out.

**Pass:** every failure in the `-rf` list is explained. A harness cause is fine if you can name it. A difference
between real Mongo and mongomock is a bug: write a test for it and fix it.

### O2. Remove the container left by the local check

Docker was shut down before this could be done. Once Docker is running:

```sh
docker rm -f birdy-stock-verify-t21
```

**Pass:** `docker ps -a --filter name=birdy-stock-verify-t21` lists nothing. It holds only seeded test data.

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
| O1 Real-Mongo rerun | | | |
| O2 Container removed | | | |
| Production flag confirmed unset | | | |

Turn on `AGENT_ADD_WRITES_ENABLED` in production only after M1 and the M7 rows pass.
