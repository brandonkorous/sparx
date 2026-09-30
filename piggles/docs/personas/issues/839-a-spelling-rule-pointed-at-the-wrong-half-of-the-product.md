# 839 — A spelling rule pointed at the wrong half of the product

**Status:** fixed
**Severity:** copy + a guard that was scanning past the defect
**Found by:** P03 · Juniper Row · act 285
**Surface:** The rail and app panels, and then everything the guard was not reading
**Filed:** 2026-09-25
**Fixed:** 2026-09-25
**Confirmed by:** the guard proved red on a brand file and green after

## It started with a badge nobody was told about

The rail's app rows carry a count of what is waiting: **Invoices 9**, **Stock 3**,
**Sell 2**, **My Site 2**. It is the only thing on the rail that changes during
the day.

```tsx
aria-label={entry.label}
trailing={<WaitingBadge count={appWaiting(entry, attention)} />}
```

`aria-label` **replaces** a control's contents for a screen reader; it does not
add to them. So the row read "Invoices 9" on screen and announced "Invoices".
The number was drawn for one kind of person and withheld from another.

The label cannot simply be dropped — collapsed, the rail is 60px of icons with
no text to fall back on, which is the whole point of collapsing it. So the count
joins it: **"Invoices, 9 waiting"**. The raw number, not the badge's own `99+`,
because "125 waiting" is worth more spoken and the shortening exists to fit a
pill, which is not a constraint speech has.

**Checked before assuming it was everywhere.** The other two `WaitingBadge` call
sites — the panel's nav rows and its section headings — carry **no** `aria-label`,
so their names come from their contents and the count is already spoken. One
place needed it, and only that place was changed.

## Two false alarms, both caught by looking

Worth writing down, because both would have been confident, detailed and wrong.

**The active rail row.** `getComputedStyle` reported the current app's row with a
transparent background and the same white text as every other row, on the real
element and on a bare probe. It reads as a textbook RULE #4 failure: the app you
are in looking identical to the fifteen you are not. **The screenshot shows it
clearly highlighted.** Whatever the computed values were describing, it was not
what is on the screen.

**The collapsed rail.** `getBoundingClientRect().width` said 256px before and
after collapsing, which would mean collapsing gives back no space at all. **The
screenshot shows a narrow icon strip and the content filling the width.**

Twice in one surface, a measurement that reads like a defect and is not one. In
this console: read the pixels. [[feedback_no_arguing_without_proof]]

## The spelling, which is the real finding

`Favourites` — the rail's own first row — is British, and the house rule names
this exact word: _color/behavior/favorite/gray everywhere, code, comments,
commits, copy._ The user-facing string already said **Favorites**; everything
around it did not.

**63 spellings across 19 files**, in identifiers and comments:
`FAVOURITES_LIST`, `favouriteKeys`, `favourited`, `Favourites`. Renamed.

Three were left alone, and each for its own reason:

| Left alone                                       | Why                                                                      |
| ------------------------------------------------ | ------------------------------------------------------------------------ |
| `keywords: ['saved', 'favorites', 'favourites']` | Search terms. Both spellings on purpose, so a British customer finds it. |
| `{ 'Favourite color': 'blue' }`                  | A TENANT's own column name in a fixture. Their data, not our copy.       |
| `…,TAGS,FAVOURITE_COLOR`                         | A Mailchimp CSV header. Somebody else's file format.                     |

The renamed value `'~favourites'` was checked before it moved: it is a sentinel
for which shortcut list the panel is browsing, held in `useState`, persisted
nowhere. [[feedback_copy_edit_breaks_identity_lookups]]

## And then the guard turned out to be looking away

`check:american-spelling` exists, is careful, and passed the whole time.

Its own header says it was written because a rule had been _"written down and
applied to one of the places it holds"_. Its `TREES` were `wizeworks/packages`
and `wizeworks/services` — **the shared server**. So a rule about the words a
business owner reads was applied everywhere except the two places she mostly
reads them: the brands' own apps. [[feedback_structural_checks_go_blind]]

Adding `piggles/apps`, `piggles/packages` and `sparx/apps`:

|                |  Before |       After |
| -------------- | ------: | ----------: |
| Files scanned  |   2,291 |   **5,549** |
| Pieces of copy | 100,330 | **309,970** |
| Findings       |       0 |      **50** |

All 50 were real customer-facing copy: 24 on each marketing site, two in the
sparx console. `centres`, `honoured`, `itemised`, `licences`, `organisations`,
`catalogues`, `specialise`, `enquiry`, `aluminium`, `theatre`, `labelled`,
`neighbours`, `centimetres`.

### The one that stings

`sparx/apps/workbench/lib/payment-methods.ts`:

```ts
check: 'Cheque',
```

The stored value is `check`. Piggles fixed its copy of this exact line as **issue
384**, and left the reason in the file:

> _That first disagreement was settled on the BRITISH spelling while the stored
> value stayed `check`, so a Denver shop owner recording a check she had just
> been handed watched the console call it a cheque._

Same file name, same map, same line, fixed in one brand and not the other, for
two months, because nothing read that tree.
[[feedback_a_fix_leaves_its_neighbour_behind]]

sparx's file now carries the fix and the reason.

## The app count, in the places a developer reads it

Issue 835 fixed the 42 places a customer could read "fifteen apps" when there are
sixteen. **Twelve more sat in comments and a README**, and two did arithmetic on
the wrong total:

> A directory per app — fifteen apps at eight files each is 120 images

Sixteen at eight is 128. Every rewrite **drops the number** rather than
correcting it: a number in a comment is a copy of a fact that lives in the
registry, and a corrected copy is the same defect one release later.

Not touched: `page-hero.tsx` and `who-its-for/page.tsx` QUOTE the old wrong copy
as history, and `docs/personas/**` are dated records of what was on screen.

## Proved red before it was believed

Put `'Cheque'` back in sparx's `payment-methods.ts`:

```
exit 1
  sparx/apps/workbench/lib/payment-methods.ts:14
      cheque -> check
```

and the same edit under the OLD `TREES` passed. Fixed again: exit 0.
[[feedback_a_test_that_cannot_go_red]]

## Measured, not swept

The same probe over identifiers and comments in the brand trees finds roughly
**800 more British spellings** — `cancelled` 200 (the wire value, which must not
move), `grey` 97, `labelled` 78, `behaviour` 35, `catalogue` 33. Most are
comments, and by the stated rule most are defects.

It is left measured rather than swept because 800 sites across two brand trees on
top of an already-large uncommitted tree is a scope call, not a defect call, and
because a guard that arrives 800 findings red is a guard that gets switched off.
The copy half — what a customer actually reads — is done and guarded.

## Files

- `piggles/apps/workbench/components/rail/app-groups.tsx`
- 19 files renamed `favourite` → `favorite` across both consoles
- 30 files, 50 spellings, in copy customers read
- `scripts/check-american-spelling.mjs` (three more trees, and the story)
- `sparx/apps/workbench/lib/payment-methods.ts`
- 12 comment and README rewrites dropping the copied app count

## The thing to remember

**A guard is an assertion about a scope, and the scope is the part that rots.**
This one was good enough to have been widened twice already, and each widening
found something, because the thing being guarded kept being somewhere the guard
was not. Before trusting a green check, read what it says it counted — this one
prints its denominator, which is the only reason the gap was visible at all.
