# 580 — A publish screen that talks about visitors, and a dark site has none

**Status:** fixed and proven on screen
**Severity:** medium
**Found by:** Devi, on My Site → Publish
**Surface:** `piggles/apps/workbench/surfaces/studio/publish-{words,pane,releases}.tsx` · `piggles|sparx/apps/workbench/surfaces/builder/blueprints-*`
**Filed:** 2026-09-16
**Follows:** [579](579-told-anyone-can-read-pages-my-site-is-not-serving.md)
**Family:** [[feedback_a_promise_in_copy_is_a_contract]] · [[feedback_a_fix_leaves_its_neighbour_behind]]

## What she saw

Having just fixed the legal pages saying strangers could read them, the very next
screen does the same thing four more times.

My Site → Publish:

> **2 pages have changes that visitors are not seeing yet.**
>
> **Every time you published**
> Saturday, September 5 · 7:58 AM · Published · 21 pages · **This is what visitors see**

Press _Put my site back to this_ and the confirm says:

> **Visitors will see the site exactly as it was on Saturday at 7:58 AM, straight
> away.** There is no publish step after this.

And on a site with nothing outstanding, the same pane reads **"Everything you
have saved is live."**

Her site serves "Temporarily unavailable · Back soon". There are no visitors.

A fifth, on My Site → Ready-made sites:

> **Live** — This design has been published: **visitors see it on your site now.**

## Why the frame is right and the sentences are wrong

Writing this pane in terms of visitors is the reason it reads well — it is the
only thing an owner actually cares about, and the file header says so:

> _Putting the site back is the ONE action in this console that changes what
> visitors see with no publish step after it._

Publishing still WORKS while the lights are off: the version changes, and it is
the version the site comes back with. So the actions are untouched and only the
sentences move, from what a stranger is seeing to what the site will carry when
it is served again.

**Now**, verified in the browser:

> **2 pages have changes that are not published yet, so they are not part of what
> your site comes back with.**
> Saturday, September 5 · 7:58 AM · Published · 21 pages · **This is what your
> site comes back with**

The confirm keeps the half that is true either way — the restore is immediate
whatever the billing says — and drops the half that is not.

## One layout defect on the same rows

The page count was `truncate`, so it shrank to **"21 pa…"** the moment the label
beside it grew. It is three words long and it is the only thing on the row that
says HOW MUCH went live, so it is now `shrink-0 whitespace-nowrap`. Same rule as
the order number in [573](573-a-list-of-deliveries-with-no-dates-on-it.md).

## Proven

**`publish-words.test.ts`** — 10 tests, including a property: none of the three
sentences may speak of visitors while the site shows nobody anything. Ignoring
the flag in all four places:

```
× does not call it live while nothing is being served
    expected 'Everything you have saved is live.' not to contain 'is live'
× stops saying visitors are not seeing them, when nobody is seeing anything
× says what the site comes back with while it is offline
× stops promising a visitor will see it straight away
× never speaks of visitors while the site shows nobody anything
```

**5 of 10 red.**

**`blueprints-words.test.ts`** / **`install-state-dark.test.ts`** — the install
badge stays `Live` and stays green, because the design IS the published one; only
the sentence changes. Every other install state comes back **identical** dark or
lit, asserted with `toEqual`.

|                 |                         |
| --------------- | ----------------------- |
| piggles console | **470 pass** (55 files) |
| sparx console   | **372 pass** (46 files) |
| typecheck       | both exit 0             |
| lint / prettier | clean                   |
