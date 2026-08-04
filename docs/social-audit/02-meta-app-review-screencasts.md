# Meta App Review — screencast scripts

Version: 1.0.0
Author: Brandon Korous
Last Updated: 2026-08-04

Four recordings covering the 14 permissions in the sparx submission. Each one is a
single unbroken take: **start signed out of sparx, connect the account on camera, then
use the permission for real.** Meta rejects videos that begin with the account already
connected — the reviewer has to watch the grant happen.

Record the **whole browser window**, URL bar included. Meta reviewers check the domain.

| Take | Platform      | Permissions | Runtime |
| ---- | ------------- | ----------- | ------- |
| A    | Facebook Page | 7           | ~3 min  |
| B    | Instagram     | 4           | ~2 min  |
| C    | Threads       | 2           | ~90 s   |
| D    | Meta catalog  | 1           | ~90 s   |

---

## Before you hit record (all takes)

1. **Connections is empty.** Social → Connections shows "No accounts connected yet".
   Already done as of 2026-08-04; if you re-record, disconnect again first.
2. **Close every workbench tab except "Start here".** A row of leftover panes reads as
   a cluttered dev environment.
3. **Site is WizeWorks**, shown in the top-left switcher.
4. **Maximise the browser.** A half-size window makes the UI look broken on playback.
5. Each take starts on the workbench home and ends on the result of the last action —
   don't cut the moment the button is clicked, let the result render.

**One thing to avoid.** The Connections screen has a "Permission check → Check my
accounts" panel. It makes a live Graph call, which is good, but on Brandon's account it
answers _"This result cannot be trusted — this account has a role on the sparx developer
app, so Meta hands it every permission whether or not App Review approved them."_ That
is the honest thing to say and it is why the panel exists, but a reviewer skimming a
video sees a red-ish box on the permissions screen. **Skip that panel in all four
takes.** The permissions are proved by using them, not by asking Meta to list them.

---

## Take A — Facebook Page (7 permissions)

Requested at connect:
`pages_show_list`, `pages_manage_posts`, `pages_read_engagement`, `business_management`,
`pages_read_user_content`, `pages_manage_engagement`, `read_insights`
(`public_profile` rides along and needs no review.)

| #   | Action                                                                                                                                                                                                                                   | Proves                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 1   | **Social → Connections.** Let "No accounts connected yet" sit on screen for a beat.                                                                                                                                                      | —                                        |
| 2   | Scroll to **Ready to connect**, click **Connect** on _Facebook Page_.                                                                                                                                                                    | —                                        |
| 3   | The Facebook dialog opens. **Pause here** so the permission list is readable, pick the **Sparx** Page, leave every toggle on, confirm.                                                                                                   | —                                        |
| 4   | Back in sparx, the connection appears with **Where posts land → Sparx** and its toggle on.                                                                                                                                               | `pages_show_list`, `business_management` |
| 5   | **Social → Posts → New post.** Click **Choose a picture**, pick one, write a line of copy, tick **Sparx / Facebook Page** as the destination. Let the right-hand preview render.                                                         | —                                        |
| 6   | **Publish now.** Wait for the status to reach **Published**.                                                                                                                                                                             | `pages_manage_posts`                     |
| 7   | Click **View** next to the destination — the real post opens on facebook.com, image and all. Let it load fully. Come back.                                                                                                               | `pages_manage_posts`                     |
| 8   | On the post, click **Refresh numbers**. Likes / Comments / Shares fill in, and the line _"Reach and views need extra permissions from the platform"_ appears. **Show that line** — it is exactly why `read_insights` is being requested. | `pages_read_engagement`, `read_insights` |
| 9   | **Social → Inbox.** The Page's comment thread is already listed, pulled from the Page feed. Open it.                                                                                                                                     | `pages_read_user_content`                |
| 10  | Type a reply in the box, click **Send reply**. It appears in the thread, marked as sent by the business.                                                                                                                                 | `pages_manage_engagement`                |

**Note on step 6.** "Posts need an admin's approval" is ON in Connections, so the normal
path is _Submit for approval_. **Publish now** deliberately bypasses it — that is the
right button for this video, because the reviewer needs to see the post reach Facebook,
not sit in a queue. If you would rather show the governance story, that is a separate
take, not this one.

---

## Take B — Instagram (4 permissions)

Requested at connect: `instagram_basic`, `instagram_content_publish`,
`instagram_manage_comments`, `instagram_manage_insights`
(plus `pages_show_list`, `pages_read_engagement`, `business_management`, already covered in Take A).

**An Instagram post must have an image.** There is no text-only branch — a post with no
picture will fail. Attach one at step 3 and check the preview renders it before publishing.

| #   | Action                                                                                                                                                                        | Proves                      |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| 1   | **Social → Connections → Connect** on _Instagram_. Pause on the Facebook dialog so the permissions are readable; pick the Business account linked to the Sparx Page; confirm. | —                           |
| 2   | The account appears under Connected accounts with its handle and avatar, and its destination toggle on.                                                                       | `instagram_basic`           |
| 3   | **New post → Choose a picture** (required), write a caption, select the Instagram destination. Wait for the preview.                                                          | —                           |
| 4   | **Publish now** → **Published** → click **View** to open the post on instagram.com.                                                                                           | `instagram_content_publish` |
| 5   | **Refresh numbers** on the post — likes / comments / reach come back.                                                                                                         | `instagram_manage_insights` |
| 6   | **Social → Inbox** — the Instagram comment appears; open it and **Send reply**.                                                                                               | `instagram_manage_comments` |

If the Inbox has no Instagram comment yet, leave one from a second account **before**
recording, then let the sweep pull it in. Do not record yourself commenting — the
reviewer only needs to see sparx read and answer it.

---

## Take C — Threads (2 permissions)

Requested at connect: `threads_basic`, `threads_content_publish`.

**Do not script an insights beat.** `THREADS_INSIGHTS_ENABLED` is `false` in production,
so `threads_manage_insights` is not in the requested scope and is not part of this
submission. Showing an empty numbers panel would only raise a question.

**Threads OAuth opens in a separate popup window**, not a tab. Make sure your recorder
captures the whole screen, not a single window, or the grant step will be missing —
which is the one thing Meta will not accept.

| #   | Action                                                                                                                                             | Proves                    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| 1   | **Social → Connections → Connect** on _Threads_.                                                                                                   | —                         |
| 2   | The Threads authorisation popup appears. Pause so the permissions are readable, approve.                                                           | —                         |
| 3   | Back in sparx, the Threads profile appears under Connected accounts.                                                                               | `threads_basic`           |
| 4   | **New post** — write the copy, attach a picture (optional on Threads, but it makes a better video), pick the Threads destination, **Publish now**. | —                         |
| 5   | Status reaches **Published**; click **View** to open the live post on threads.net.                                                                 | `threads_content_publish` |

Threads runs on its own Meta app id (`1057523100160709`) against `graph.threads.net`. It
is the same sparx app wearing its Threads use case, so the recording belongs in the same
submission — no separate app needed.

---

## Take D — Meta catalog (1 permission)

Requested at connect: `catalog_management` (with `business_management`).

**Different surface.** This is not the Social module — it is a sales channel, under
**Integrations**. Do not try to record it from Connections.

| #   | Action                                                                                | Proves               |
| --- | ------------------------------------------------------------------------------------- | -------------------- |
| 1   | **Integrations**, find the **Meta** channel, click connect.                           | —                    |
| 2   | Facebook dialog — pause on the permission list, approve.                              | —                    |
| 3   | sparx resolves the business's product catalog and shows its **name** on the channel.  | `catalog_management` |
| 4   | Trigger a **product sync** and let it finish.                                         | `catalog_management` |
| 5   | Open the catalog in Meta Commerce Manager and show the synced products landing there. | `catalog_management` |

Step 3 is the one that matters: sparx reads the business's owned catalogs and picks one.
If the catalog cannot be resolved the connect still succeeds by design (the merchant is
connected, the catalog is resolved later) — so **check the channel shows a catalog name
before you keep the take**, otherwise the recording proves nothing.

---

## After all four are recorded

1. Upload each video to **its own permissions** in App Review → Allowed usage. The same
   file can be attached to several permissions — Take A goes on all seven.
2. **Fill in the reviewer test account.** `accesscode-web-1` is currently empty while the
   instructions text promises credentials. A reviewer who cannot sign in rejects the
   submission without watching anything. This needs a real sparx login with the WizeWorks
   site and the social module on — **Brandon has to create it and enter it**; I can't
   create accounts or handle passwords.
3. Consider **detaching the unused "Create & manage ads with Marketing API" use case**.
   It sits at "Testing in progress" with no ads permissions requested, and an incomplete
   use case invites questions about a submission that is otherwise clean.
4. Submit, then **Publish the app**.

## Known-good state at time of writing (2026-08-04)

Media publishing works end to end — verified with a real image post landing on the Sparx
Page. It took three fixes, all shipped: the image origin never crossed from the retired
GCP terraform to Azure (`133edfd1`); adapters classified attachments by file extension,
so extensionless stock URLs were dropped on Facebook and mistaken for **video** on
Instagram/Threads (`f7cf1fe5`); and the resolver required a transcoded variant that stock
assets never have and fresh uploads don't have yet (`b5743a13`). Any of the three alone
still produced a silent, successful-looking text-only post — worth knowing if a future
take comes out with the picture missing.

**Unrelated and still open:** `media-worker` is running and subscribed to
`media.uploaded` but its log shows only startup lines — no upload appears to be getting
transcoded. The social path no longer depends on that, but it means images may be served
as full-size originals elsewhere. Worth a look after the submission.
