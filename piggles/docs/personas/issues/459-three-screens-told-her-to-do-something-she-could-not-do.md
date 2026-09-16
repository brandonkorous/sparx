# 459 — Three screens told her to do something she could not do

**Status:** fixed
**Severity:** minor
**Severity note:** minor by damage, not by frequency. This is the FIRST screen of a whole app, so every business that ever opens Social meets it, once, before anything else.
**Found by:** Devi opening Social for the first time — zero connections, zero posts
**Surface:** `social.calendar`, `social.queue`, `social.insights` (both consoles)
**Filed:** 2026-09-09

## What was wrong

Devi has never used Social. Nothing connected, nothing posted. Three of the eight
screens greeted her with an instruction she could not follow.

| screen             | what it said                                                     | why she could not                                                                                    |
| ------------------ | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Calendar           | "No posts yet — **click any day to write your first one**."      | Clicking a day opens the composer, which says there is nowhere for a post to go, and sends her back. |
| Posts              | one action: **New post**                                         | Same trip.                                                                                           |
| How your posts did | "**Open a post you have already sent** and hit Refresh numbers." | She has never sent one. The instruction names a thing that does not exist.                           |

The composer is not at fault — it does the right thing, and its own comment says
why: _"the one thing to do IS connecting an account, so it is the whole screen."_
The three screens before it just did not know that yet.

## The fact was already in their hands

None of this needed a new request. `useSocialOverview` carries `connections`, and:

- **Insights already called it** — twice, for the account avatars — and its empty
  state still said "open a post you have already sent".
- **Calendar and Posts** share `useSocialBoard`, which **already returns
  `overview`**. Both had it and neither read it.

[[feedback_fetched_but_never_rendered]] again, three panes at once: the value the
screen needed was in the component, and nothing drew it.

## The fix

One derivation in the shared hook, because two views need it and one place is
where it belongs:

```ts
const nothingConnected = overview.isSuccess && overview.data.connections.length === 0;
```

`isSuccess`, not `?? []`. While the list is loading nobody knows yet, and reading
an empty array as "nothing connected" would show every business the first-run
sentence on every cold open — the same loading trap as [457]'s module gate.

Then three sentences, and one action:

- **Calendar** — "Connect an account first and your posts appear here, on the days
  they go out."
- **Posts** — "Connect the accounts your business already has, then write once and
  post to all of them…" and its primary button becomes **Connect an account**,
  opening `social.connections`. That is the same decision the composer already
  made, applied one screen earlier so the detour never happens.
- **How your posts did** — "Nothing is connected yet, so there is nothing to
  measure. Connect an account, post something, and how it did shows up here."

The old wording is kept for the case it was always right for: connected, but
nothing posted yet. Two causes, two sentences — [[feedback_one_outcome_two_causes]].

## Confirmed on screen

All three, on Juniper Row, in the state she actually has. The **Connect an
account** button opens **Your social accounts** — which is now also what its tab
says, after [458].

## What was left alone

The toolbar's own **New post** button, on both panes. It is standard pane chrome
rather than the empty state's answer to "what now", and the composer explains
itself properly when it opens. Changing that too would have made the create
affordance mean different things in different places.
