# 719 — The rename reached the tab and nothing else

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 251
**Surface:** mypiggles — 23 panes across Stock, Selling, Customers, Website, Dropship, Bookings and Settings
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on the screen: Half-finished checkouts no longer says "checkout sessions" anywhere in its own body
**Blocked on:** —

## What happened

Found while reading the label pane's copy. It said "Scanning it in **warehouse
mode**", and there is no screen in Piggles called warehouse mode. It is called
**Scanner mode** — the tab says so, the rail says so, the search says so.

Pulling that thread found the general case.

Piggles renames the shared console's screens in `lib/console/vocabulary.ts`,
because sparx names things by category and Piggles names them by what you are
doing. That file's own header says why:

> A screen's name is the shortest copy in the product and the most-read, so it
> gets the same treatment as a sentence: **WRITTEN, never substituted.**

The rename reaches the tab, the rail and the launcher. It reaches nothing
inside the pane, because those sentences are typed into the component and pass
through no lookup at all. So:

| the tab says            | its own body says                                 |
| ----------------------- | ------------------------------------------------- |
| Half-finished checkouts | Loading checkout sessions… · No checkout sessions |
| Special prices          | Search price lists · No price lists yet           |
| Things you track        | Could not load your record types                  |
| Orders to suppliers     | No purchase orders yet · Loading purchase orders… |
| Practice data           | Load sample data · Remove all sample data         |
| Wholesale prices        | A price tier is a named trade level…              |

## Why it matters

Two names for one thing, on one screen, and the second one is always the word
the rename exists to keep away from her. A shop owner who has learned "Special
prices" from the menu opens it and is asked about price lists; the sentence that
DEFINES the thing for somebody who has never seen it defines the wrong word.

The sample-data pane is the clearest case, because the fix had already been made
there once. Its own header:

> The BRAND's name for this screen, not the literal. The rail calls it "Practice
> data" and this line called the dock tab "Sample data" — **one screen with two
> names, and the one a person clicked was not the one they landed on. Issue
> #012.**

Issue #012 changed the tab. The seventeen sentences below it went on saying
sample data. [[feedback_a_fix_leaves_its_neighbour_behind]]

**MEASURED 2026-09-19:** 48 screens renamed by more than one word, 1,867
sentences inside them, **99 calling the screen by the name Piggles renamed
away** — 84 by the plural, 15 more by the singular, including seven toolbar ARIA
landmarks that announce the sparx name to anybody using a screen reader.

## What was done

Every one of the 99 rewritten, by hand.

**By hand is the finding, not an aside.** The first pass was a codemod that
substituted the name, and it produced:

> "Could not load your page results" → **"Could not load your how your pages do"**

which is exactly what `vocabulary.ts` warns against two paragraphs above the
list. The sweep was reverted off a backup and the sentences were written:

| was                                                       | now                                                       |
| --------------------------------------------------------- | --------------------------------------------------------- |
| Could not load your page results                          | Could not load how your pages are doing                   |
| Sales channels controls                                   | Controls for where you sell                               |
| A purchase order is what you send a supplier to buy stock | An order to a supplier is what you send them to buy stock |
| Record type _(a column heading)_                          | Thing you track                                           |

**The label pane reads the name rather than spelling it.** `document-label.tsx`
now calls `surfaceTitle('inventory.warehouse')`, so the sentence follows the
rename instead of needing to be found again next time.

**`piggles/scripts/check-screen-names.mjs`** — new, wired into
`pnpm check:screen-names` and pre-push. It compares each pane's sentences with
the name THAT pane has, resolved through the catalog's import line, and prints
the denominator.

Three things it had to learn, each found by reading its output rather than
trusting it:

1. **Only its own screen.** Matching every renamed title against every file said
   the scheduling waiting list was using Stock's word and that "printed on
   purchase orders" was a screen reference. Both nonsense.
2. **Comments are not copy.** The rationale note explaining a rename quotes the
   old name on purpose; reading it as copy made the guard demand its own
   explanation be rewritten.
3. **A name can contain the old one.** "What matters" became "What matters most",
   so every correct sentence matched.

`Search Console` stays: it is Google's name for Google's screen, and a sentence
sending somebody there has to say what they will see. Exempted by surface key so
it cannot spread.

## Files

- `piggles/scripts/check-screen-names.mjs` — new, wired into pre-push
- 23 surfaces across seven modules, plus `document-label.tsx` in both consoles

## Proof

Put `title="Could not load checkout sessions"` back: the check exits 1 naming the
file, the line, the sentence and both names. Restored: `48 renamed screens, 1867
sentences in them, and every one calls the screen what the tab calls it.` 999
tests pass, typecheck and ESLint clean.

On screen: **Half-finished checkouts** now opens on "9 checkouts, worth
$2,202.00", and the label pane reads "Scanning it in **scanner mode**".
