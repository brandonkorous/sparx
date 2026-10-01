# 905 — Automation cards printed the machine names under the plain ones

**Status:** fixed
**Severity:** **minor** — nothing broke, but every card on the automation
editor carried a second line in code type that said the first line again in
words a shop owner does not use
**Found by:** P03 · act 321, on "Announce new blog post"
**Surface:** `automations.detail` flow canvas and run detail (both consoles)
**Filed:** 2026-09-30
**Fixed:** 2026-09-30
**Confirmed by:** walked on screen

## What she saw

| Card       | Title                           | The line under it           |
| ---------- | ------------------------------- | --------------------------- |
| The rule   | Announce new blog post          | Paused · loop-guard depth 3 |
| When       | An article or page is published | `content.entry.published`   |
| Conditions | Runs every time                 | Runs on every trigger       |
| Step 1     | Post to social media            | `social.post`               |

A run's step card did the same: `social.post` under "Post to social media".

## Why the checks missed it

`check:plain-words` reads the words written in the source. These came out of
the data (`trigger.eventType`, `action.type`), so the check could not see
them. The code said why they were there: "the canvas shows the raw event name
(the detail) in mono", a hint for whoever built the rule.

## Now

| Card       | The line under it                                                              |
| ---------- | ------------------------------------------------------------------------------ |
| The rule   | Paused · chains up to 3 deep (the settings call it "How deep rules may chain") |
| When       | Runs the moment this happens                                                   |
| Conditions | Add a condition to run it only some of the time                                |
| Step 1     | Get Found (the app the step works in)                                          |

The run's step card names the app the same way. `isCuratedTriggerEvent` had no
other job and is gone.
