# 831 — A storage key drawn as a name, and a bar with nothing in it

**Status:** fixed
**Severity:** copy + correctness
**Found by:** P03 · Juniper Row · act 281
**Surface:** mypiggles workbench — one ready-made site, and the two Form settings panes
**Filed:** 2026-09-25
**Fixed:** 2026-09-25
**Confirmed by:** seen on screen as Devi, including a real save

## "Comes with the glossy-fashion look"

Devi opened **Glossy Fashion** in Ready-made sites, and What this adds to your
site said:

> Comes with the **glossy-fashion** look (colors, fonts and spacing) applied for
> you.

`contents.theme` is a storage key and it was drawn verbatim. Measured on the dev
catalog: **191 designs carry a theme, 79 of those keys have a hyphen in them**
(`retail-plant-modern`, `b2b-apparel-blanks`, `portfolio-developer`), and
`marketplace_themes.name` is the key again, so there was no display name
anywhere to reach for.

And the sentence had a second problem underneath the first. **40 of the 191 keys
are the design's own name, slugified**, so for those the pane said:

> Glossy Fashion comes with the Glossy Fashion look.

A name repeated back to somebody who read it four lines ago. `lookSentence`
turns the key into words, and when the words are just the design's own name
again it says the useful half without the echo:

> Its colors, fonts and spacing come set up for you.

## "B2b", and a word from a catalog taxonomy

The design's kind was drawn by title-casing `vertical`. Four values exist:
`services` (111 designs), `retail` (50), `content` (18), `b2b` (12) — so a shop
owner read "Retail", "Content", and for twelve designs **"B2b"**.

"Retail" is not wrong so much as empty: it is a word from a catalog taxonomy,
and somebody choosing a design wants to know what the design is set up to DO.

| Stored     | Read                            |
| ---------- | ------------------------------- |
| `retail`   | For selling things              |
| `services` | For taking bookings             |
| `content`  | For publishing                  |
| `b2b`      | For selling to other businesses |

**Both the gallery card and the detail line had their own private copy of the
same three lines of title-casing code**, so both said "B2b" and neither knew the
other existed. One `verticalLabel` in `blueprints-words.ts` now, which is where
this app's other words live. Same story as issue 822's six copies of the module
table.

## The design's own pane did not say its name

`blueprint-detail.tsx` put the name in the dock tab and nowhere else, so the
first thing on the pane was a category and a version number:

> Content · Version 1.5.1

A read-only detail surface keeps its identity heading (DESIGN.md). It reads:

> **Glossy Fashion**
> For publishing · Version 1.5.1

## "Preview" is not a status

The bar's only word, when the design was not on the chosen site, was **Preview**
— a MODE, and a state of nothing. What that bar is for is saying where this
design stands on the site the picker below is pointed at, which, when there is
no install, is that it is not on it:

> Not on Juniper Row yet

Note "the site the picker is pointed at", not the site the console is working
on. They can differ, and the badge beside it has always been about the former.

## A bar with nothing in it at all

`<PaneToolbar label="Form settings controls" />` — no status, no search, no
action, no refresh. It renders a bordered card containing nothing, above a list.

It says how many forms the site has, which is the fact the list exists to show.

## The page a form sits on was only ever a placeholder

The edit pane's bar was empty too, and the fix there is worth writing down
because the fact was genuinely unreachable. `pageSlug` appeared exactly once on
the pane: as the Name field's PLACEHOLDER, which disappears the moment the form
has a name of its own. Devi's is called "Messages from my website", so nothing on
the screen said which page's form she was editing. With more than one form that
is the only thing telling them apart.

> **On /contact**

`formPageWords` follows the same convention as the submit route and the funnels
form picker — a null slug is the home page — so the three cannot describe one
form differently.

## Three states that were two different shapes

Both Form settings panes and the blueprint pane did this:

```tsx
if (isLoading || !data) return <PaneWaiting />;
```

A bare `<PaneWaiting>` with no `PANE_SHELL` and no card: no pane background, no
content region, and no `module`, so the generic mark instead of this app's own
artwork. Waiting and loaded were two different shapes.

And the form PICKER returned its failure before the toolbar, which is the shape
`pane-load-error.tsx` names in its own header as the thing never to do — it takes
the bar away with the list, when nothing about the bar is broken. **Seen on
screen**: a failed read during this pass rendered the message in a pane with no
chrome at all.

## Files

- `piggles/apps/workbench/surfaces/builder/{blueprint-detail,blueprint-detail-parts,blueprints-list,blueprints-words,form-settings,form-settings-pick,form-settings-fields,form-settings-column}.tsx|ts`

## Noted, not a defect

The form's stored confirmation message still carried an **em dash** — "Thanks
for reaching out — we've received your message" — while every source default
(`builder-schemas/forms.ts`, `forms-silica.ts`, `automation-actions/resolvers.ts`)
says it with a colon. The row predates the sweep that fixed the source. It is
one row, written by this persona in an earlier act, and it was corrected through
the pane, which also proved Save works. Same shape as issue 819's 179 seeded
automations: **a stored sentence does not change when its source does.**

## The thing to remember

**A key is not a name, and the absence of a name is not permission to print the
key.** `glossy-fashion`, `b2b`, `retail-plant-modern` — none of them was ever
meant to be read, and each reached a screen because the pane needed a word and
the key was the only string in hand. When there is no name, the fix is to write
one, in the file where that app's other words already live.
