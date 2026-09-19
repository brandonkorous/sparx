# 638 — My saved replies never said which shop they belonged to

**Status:** fixed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 219
**Surface:** mypiggles › Messages › Quick replies
**Filed:** 2026-09-17
**Fixed:** 2026-09-17
**Confirmed by:** P03 · Juniper Row · act 219 (seen on screen, before and after)

## What happened

Messages › Quick replies. The form at the top asks a real question:

> **Where it is offered** — This site only / All my sites
> _Keep business-specific wording to this site; use "All my sites" for generic
> replies._

Below it, **Your saved replies · 7 replies**. Each row: a name, a `/shortcut`
badge, the message, a delete button. **Nothing about where it is offered.**

I run seven websites. So seven identical-looking rows, and no way to know which
of them my Press site or my Sample Sale would show. If I add one here and then
change shop, it is simply gone, and this screen never says why.

## Why it happened

Three places, each one step further from the choice.

**1. The API threw the field away.** `QuickReplyDto` selected the row and mapped
five fields out of six:

```ts
export interface QuickReplyDto {
  id;
  title;
  body;
  shortcut;
  createdAt;
  updatedAt; // no propertyId
}
```

So no caller could have shown it. This is the "fetched but never rendered" shape
one stage earlier: fetched, then dropped before anything could render it.

**2. The list is deliberately a MIX, and said so nowhere.** The service's own
note explains the design at length:

> BOTH tiers, not most-specific-wins … These are a PALETTE an agent picks from
> rather than a single answer to one question, so a site-specific reply ADDS to
> the generic ones instead of replacing them.

The thinking was done and written down. The row that renders the result shows
`title`, `shortcut`, `body` ([[feedback_a_fix_leaves_its_neighbour_behind]]).

**3. The pane's own header comment explains the choice too**, in the owner's
language — "a note about fresh-baked donuts has no place in a machine-shop
thread". Same file. The form got it; the list did not.

Measured 2026-09-17:

|                             |       |
| :-------------------------- | ----: |
| her saved replies           | **7** |
| offered on every site       | **7** |
| websites she runs           | **7** |
| rows on screen saying which | **0** |

## The sharp end: the delete

Every one of her seven replies is shared, and the confirmation read:

> Your team will no longer be able to send this saved reply. This cannot be
> undone.

True, and silent about the six other shops it just left
([[feedback_destructive_actions_confirm]] — name the target AND the loss). It now
reads, confirmed on screen:

> **Delete "Anything else"?**
> This reply is offered on **all 7 of your sites**, so it goes from every one of
> them. Your team will no longer be able to send it anywhere. This cannot be
> undone.

## The fourth part: a control with nothing to choose

The shared `SiteScopeField` states the house rule in its own header:

> Renders NOTHING for a tenant with one site: there is no choice to make, and an
> always-on toggle reading "every site" is noise on the 99% case.

This pane hand-rolled its own Select and showed it to everybody. It is now hidden
below two sites — and, with it hidden, a new reply is saved as **every site**
rather than stamped to the one shop that exists. A person who was never asked did
not choose "this site only", and pinning her replies to today's shop would mean
none of them followed her to a second one. It is also already what the seeded
replies carry.

## The fix

`propertyId` rides the DTO. Three sentences live in `quick-reply-words.ts`, and
every one of them takes the SITE COUNT, because a business with one site must
never read a sentence about sites it does not have.

| sites | a shared reply   | a reply for this site |
| ----: | :--------------- | :-------------------- |
|     1 | _(no note)_      | _(no note)_           |
|     7 | **All my sites** | **This site only**    |

BOTH states are named. Marking only the shared ones would leave a bare row
meaning "the other thing", which is the same blank-means-something trap as
[[637]]'s empty count cell. The two labels are the compose form's own two
options, word for word, so the list reads back what she chose in the words she
chose it in ([[feedback_honor_the_users_choice]]).

Seen on screen: seven rows reading **All my sites**, and a new "Linen care"
reading **This site only**.

## Noted, not fixed here

**A saved reply cannot be edited.** The row has a delete button and no other
action, and clicking the row does nothing — a typo in a message means deleting it
and typing the whole thing again. That is a missing capability rather than a
wrong one, and it wants its own pass.

## Guard

`quick-reply-words.test.ts`, **7 tests** in each console. The two that are rules:

```ts
it('names BOTH states, so a bare row never means the other thing', …)
it('says how many sites it goes from', …)
```

Proved red by marking only the shared rows and flattening the delete sentence:
**3 of 7** fail.
