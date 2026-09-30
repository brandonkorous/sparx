# 835 — The number on the front page was never right

**Status:** fixed
**Severity:** correctness (a countable claim, wrong everywhere, including the Terms)
**Found by:** P03 · Juniper Row · act 282
**Surface:** meetpiggles — every page of it, plus the account app and the console's share card
**Filed:** 2026-09-25
**Fixed:** 2026-09-25
**Confirmed by:** read on screen at full width and at 360px

## What was on screen

The first thing on `/apps`, in the largest type on the page:

> **Fifteen apps. One subscription. No upgrade buttons.**

Directly underneath it, a grid of app tiles, five to a row:

> Home · My Site · Content · Get Found · Campaigns
> Sell · Stock · Partners · Customers · Messages
> Bookings · Invoices · Money · My Team · Automations
> Connections

**Sixteen.** The page invites the count and then fails it, in the two inches
between the heading and the picture.

## It was never right, not once

`git log -S` puts the registry entry for `get_found` and the words
"Fifteen apps" in the **same commit**. There was no moment when an app was added
and the copy lagged: the number was typed wrong at birth and every page written
since copied it.

**42 live sentences across 24 files**, in three apps:

| Where                    | Sentences | Worst of them                                              |
| ------------------------ | --------: | ---------------------------------------------------------- |
| meetpiggles              |        38 | the /apps headline, the /pricing headline, the OG images   |
| The account app          |         2 | "All fifteen apps, one price." on the sign-up panel        |
| The console              |         1 | the workbench OG image, on every link anybody shares       |

And one of them is not marketing:

> **Terms** — "One subscription gives you every one of the fifteen apps, from
> the first day. There are no tiers, no per-app charges and nothing behind an
> upgrade button. If it is one of the fifteen, it is included."

That is a **term of the subscription**, in the document that says what somebody
is buying, undercounting what they get. It says it twice.

## Then the arithmetic on top of it

Two pages do sums with the wrong total, so they were wrong twice over.

**`/apps/[app]`** closes every app page with:

> Sell is in the $99 plan. **So are the other fourteen.**

Sixteen minus one is fifteen. Off by one, on a number derived by hand from a
number that was already off by one.

**The home page's Day** ends its six-beat Thursday with:

> **Eight apps before six o'clock.** You opened one.
> **The other seven** were there the whole time.

Eight and seven is fifteen. And the comment sitting directly above those two
lines in the source said:

> _"Eight and seven, not six and nine. The rail lights eight apps across the day
> and a visitor can count both numbers on screen — a claim the page makes with
> its own furniture has to survive being checked."_

The instinct was exactly right. The check it asks for was never run. The rail
does light eight (counted from `BEATS`), so the eight is correct and the seven
should always have been eight.

**`/who-its-for`** does it eleven times: each trade names three apps and then
says "The other twelve are there too." Three plus twelve is fifteen.

## The fix is the registry, not a bigger number

Replacing "fifteen" with "sixteen" in 42 places moves the bug one app along.
The count belongs to the registry, so it comes from the registry:

```ts
export const APP_COUNT = APPS.length;
export const APP_COUNT_WORD = numberWord(APP_COUNT); // "sixteen"
export const APP_COUNT_WORD_CAP = …;                 // "Sixteen"
export const OTHER_APPS_WORD = numberWord(APP_COUNT - 1); // "fifteen"
export const numberWord = (n) => …;
```

Spelled, not a numeral, because these land mid-sentence in marketing copy where
a digit reads as a price or a version. `pricing/page.tsx` already said so in its
own comment.

The two pages that do arithmetic now do it from the data they draw:

- The Day counts `new Set(BEATS.flatMap((b) => b.lights)).size`, so "eight" and
  "the other eight" are one fact said twice rather than two numbers somebody
  keeps in step.
- `/who-its-for` counts `APP_COUNT - trade.leans.length` per card.

## A private list that stopped one short

`answer-receipt.tsx` — the live panel on the home page that adds up somebody's
answers — kept its own array of number words ending at `'fifteen'`, with
`WORDS[n] ?? String(n)`. With sixteen apps the one row that can name them all
fell off the end and printed **`16`**, a numeral, on a page whose own comment
says a numeral there reads as a second figure. It uses the shared `numberWord`
now and keeps only its deliberate `'no'` at zero.

## `check:app-count`, and what writing it taught

A new guard, wired into `package.json` and the pre-push hook. It reads the
registry as text, counts the `id:` lines, and fails on a spelled number that
claims to be the total and is not. **Proved red** by typing
`heading="Fifteen apps. One subscription."` back into `/apps`.

Two things about it are worth keeping.

**The first draft was too clever and flagged eleven innocent sentences.** It
accepted a bare "all `<word>`", to catch "All fifteen, from the first day", and
came back naming _"Give all three measurements"_, _"one of the two answers"_ and
_"fills an empty box even when the other one was typed over"_. A guard that
cries about a stock count is a guard somebody switches off. The number has to
touch the word "app" now, and four old phrasings escape it. That is the right
trade. [[feedback_a_test_that_cannot_go_red]]

**The first exemption it wanted was the biggest finding.** "Eight apps before
six o'clock" is a subset count, not a total, so it looked like a legitimate
thing to forgive, and it was written into a `SUBSET` list with a paragraph
explaining why. It was only reading the sentence NEXT to it — "the other seven"
— that showed the pair added to fifteen. The exemption list is empty now, and
the comment where it used to be says so.
[[feedback_check_the_gate_before_accepting_it]]

The green line prints both denominators, because after the sweep there is
nothing left to compare and "0 sentences, all correct" is the same line a broken
scan prints:

```
check:app-count — 16 apps in the registry. 75 sentence(s) take the count
from it, 0 spell it out, and all of them agree. 1917 file(s) read.
```

It fails if the derived uses drop below 20. [[feedback_structural_checks_go_blind]]

## Adding an app is now a one-line change

The second red test was to add a seventeenth app to the registry. The guard
stayed **green**, and that is the correct answer: every sentence on the site
already said seventeen. That is the whole point of the change.

## The app page itself, read as Devi

Scored on `/apps/sell`, which is the one a clothes maker opens. Once the count
was right it is a strong page: it says what the app does in her words, and it
names the trade word only to disown it.

> Most software calls this **ecommerce**. In Piggles it is called **Sell**,
> because that is what you are actually doing.

Six honest section headings ("Returns, honestly"), real integration names rather
than a vague claim, and a closing line that does not oversell. At 360px it
stacks to one column with no sideways scroll: `scrollWidth` equals
`clientWidth`, and nothing on the page is wider than its container.

## Files

- `piggles/packages/config/src/app-index.ts`
- `piggles/scripts/check-app-count.mjs` (new), `package.json`, `.githooks/pre-push`
- 24 files across `piggles/apps/web`, `piggles/apps/account` and the console's OG image

## The thing to remember

**A number in a sentence is a copy of a fact that lives somewhere else.** This
one was copied 42 times from a source that was wrong, and then two pages did
arithmetic on the copy. Nothing in the repo compared a number to anything, so
every check stayed green for the product's whole life over a claim any visitor
could disprove by counting the tiles under the headline.
