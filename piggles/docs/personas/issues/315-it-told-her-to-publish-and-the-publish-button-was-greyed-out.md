# 315 — It told her to publish, and the publish button was greyed out

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · confirming [313]
**Surface:** mypiggles › Home, and My Site › Publish
**Filed:** 2026-08-28
**Fixed:** 2026-08-28
**Confirmed by:** driven as Devi on 2026-08-28 — both roads, end to end

## What happened

Driving [313]'s own confirmation found this, which is the shape a check is for: the
data was right and the sentence built on top of it was wrong.

Devi's site has a header from before the account control existed. Home tells her:

> **Your live site is behind the one you have saved**
> Until you publish, the people visiting your site do not get these:
> · Your customers have no way to get back to their account, their orders or a return.
> Publishing puts them on your site. Nothing you have written changes.
> **[ Review and publish ]**

She presses the button. The Publish pane opens and says, at the same time, on one
screen:

> **Everything you have saved is live.**
> There is nothing waiting. Anything you change from here will need publishing again.
>
> **Your visitors are not getting these yet**
> These are already in your saved header and footer. Your live site does not have
> them until you publish.
> · Your customers have no way to get back to their account, their orders or a return.

And **"Publish everything" is greyed out.** The one thing she was sent here to do
cannot be done.

## What should have happened

The screen should tell her the truth about her own site and offer her the thing that
fixes it.

Nothing here is broken in the data. The gap is real, her customers really cannot reach
their account, and the platform really can repair it. What is wrong is that BOTH
surfaces describe one of the two ways to have that gap, and she has the other one.

## How to reproduce

Every time, on a site whose owner has never opened the header and footer.

1. Have a published site whose header carries the old stamped "Sign in" rather than
   the live account control. Fifteen of the twenty two sites live in this database
   are in exactly that state.
2. Do not open **My Site › Header & footer**.
3. Open Home. The panel appears and says the live site is behind the saved one.
4. Press **Review and publish**.
5. Publish says there is nothing waiting, the button is disabled, and the warning
   below it says the opposite.

## Why it matters

**It is a dead end, and it is the case the panel was written for.** The owner who most
needs telling is the one not opening the builder ([313] says so in as many words), and
that is precisely the owner for whom the button does nothing.

**Two sentences on one screen contradict each other.** "There is nothing waiting" and
"Your live site does not have them until you publish" cannot both be true, and an owner
who reads both learns to trust neither.

**The remedy printed on the screen is not available.** This is
[[feedback_one_outcome_two_causes]] again: one outcome, two causes, and the message is
written for the wrong one. The advice in a message is part of the contract, and this
advice sends her to a disabled button.

## Where it lives

`liveChromeGaps` finds the gap from **two** sources, deliberately, and that part is
right:

- **The saved draft has it.** She opened the builder, the repair ran, it is waiting on
  a publish. Publishing fixes it.
- **The repair WOULD add it.** She has never opened the builder, so nothing has run and
  her draft is exactly as stale as her live site. **Publishing fixes nothing** — it
  republishes the same stale tree, which is why there is nothing to publish and the
  button is correctly disabled.

The gap carries no record of which source it came from, so both surfaces assume the
first. The repair itself runs on **studio load** (`healFrameTx`, called from
`loadFrame`), so the thing that actually resolves the second case is opening
**Header & footer** — which nothing on either screen mentions.

- [wizeworks/packages/silica-catalog/src/live-chrome-gap.ts](../../../../wizeworks/packages/silica-catalog/src/live-chrome-gap.ts)
- [piggles/apps/workbench/surfaces/home/site-refresh.tsx](../../../../piggles/apps/workbench/surfaces/home/site-refresh.tsx)
- [piggles/apps/workbench/surfaces/studio/publish-gaps.tsx](../../../../piggles/apps/workbench/surfaces/studio/publish-gaps.tsx)

## The fix

Carry the source on the gap, and let each surface say and do what is true for it.

**1. `ChromeGap` gains a `source`.** `'saved'` when the draft already has it and only a
publish is missing; `'waiting'` when nothing has run yet and the repair is what supplies
it. `'saved'` wins when both are true, because publishing genuinely resolves it then.

**2. Home branches on it.** A `saved` gap keeps today's panel — it is correct for that
case. A `waiting` gap says the improvement has not been applied to her copy yet and its
button opens **Header & footer** (`builder.layout`), which is the read that runs the
repair and saves it. From there the pane's own Publish is enabled and says so. Two
steps, each of them true, instead of one step that is false.

**3. Publish stops claiming a `waiting` gap is waiting on a publish.** That pane answers
"what happens if I publish", and publishing does not resolve a `waiting` gap, so listing
it under "until you publish" is simply wrong. `saved` gaps keep the current wording;
`waiting` gaps get their own line naming the header and footer.

### And one the drive turned up

Point 2 was not enough on its own, and only driving it showed why. The repair rides along
with the studio's READ, and `useLayout` holds its tree at `staleTime: Infinity` while the
editor copies that into its own store once — so sending her to a pane that was already
open changed nothing at all. The button opened the header and footer and the stale header
was still sitting there.

So the repair is now an ACTION rather than a side effect of a read:
`POST /v1/builder/layouts/silica/repair` applies it to the draft because she asked,
`useRepairChrome` calls it and then hands the repaired document to whatever pane is
holding the old one — the same `reloadDocument` a restore uses, and for the same reason:
this is the one write where the server, not the pane, is the authority. Draft only, so her
visitors still see nothing until she publishes.

## Confirmed by

Driven as Devi on 2026-08-28, both roads, on **Juniper Row Archive**.

**The `waiting` road**, with the header-and-footer pane deliberately left OPEN, which is
the case that defeated the first attempt at the fix. Home said:

> **Your header and footer can do more than they are**
> The people visiting your site do not get these yet:
> · Your customers have no way to get back to their account, their orders or a return.
> Open your header and footer and we will put them in for you. Publish from there and your
> visitors have them. Nothing you have written changes.
> **[ Open my header and footer ]**

Pressed it. The repair ran, the open pane was re-seeded, and `site.account-link` was back
in the header where the stamped "Sign in" had been. Published from that pane, went back to
Home: the panel was gone.

**The `saved` road** was driven first, on the same site: Home said "Your live site is
behind the one you have saved", **Review and publish** opened the Publish pane, and there
the two sentences finally agreed — "your header and footer have changes that visitors are
not seeing yet" with **Publish everything ENABLED**, above "These are already in your saved
header and footer. Your live site does not have them until you publish." Publishing
cleared both.

**The contradiction is gone.** The Publish pane no longer claims a `waiting` gap is waiting
on a publish, and the button it names is the one that works.
