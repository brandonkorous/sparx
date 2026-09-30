# 723 — The other half of the rename

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 254
**Surface:** mypiggles — 49 files across Stock, Selling, Customers, Website, Dropship, Money, Automations and Partner
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on the screen: Your own columns heads its last section "Orders to suppliers", the same words as the menu item
**Blocked on:** —

## What happened

Opened **Your own columns** to see what it does. Four sections: Items, Stock at a
location, Suppliers, and one headed:

> **Purchase orders**

The menu item that opens that screen says **Orders to suppliers**. It has said so
since the rename. This is a different screen naming it, so
[719](719-the-rename-reached-the-tab-and-nothing-else.md)'s check never looked.

## Why it matters

719 fixed 99 sentences and its guard was deliberately narrow: it compares a
pane's sentences with the name THAT pane has, resolved through the catalog. It
was narrowed for a good reason, because the wide version claimed the Bookings
waiting list was using Stock's word. But narrow left two whole shapes standing:

**A detail pane is its own surface.** Only the LIST is renamed, so
`price-list-detail.tsx` said "price list" **sixteen times** under a tab reading
Special prices, and the check had nothing to compare it against. Same for
content types, purchase orders, stock sources, price tiers, supplier orders and
payment providers.

**A pane can name a DIFFERENT screen.** Your own columns, the spending-limit
rules, the supplier's page, the scanner, the units list.

**MEASURED 2026-09-19**, one run against the untouched tree: **96 breaches at 90
places in 47 files**, and 10 more once the check learned to read template
literals. Six sentences name two screens at once, which is why the
places are fewer than the breaches.

| the tab says          | what another screen said                                                     | how many |
| --------------------- | ---------------------------------------------------------------------------- | -------- |
| Orders to suppliers   | purchase order                                                               | 29       |
| Special prices        | price list                                                                   | 18       |
| Wholesale prices      | price tier                                                                   | 8        |
| Kinds of content      | content type                                                                 | 8        |
| What they are sending | supplier order                                                               | 8        |
| Counts from elsewhere | stock source                                                                 | 6        |
| Form replies          | form submission                                                              | 3        |
| Other languages       | product translations                                                         | 3        |
| How you take payment  | payment provider                                                             | 3        |
| Where it is listed    | product listing                                                              | 2        |
| What you told us      | your feedback                                                                | 2        |
| six more, one each    | record type, warehouse mode, lots & serials, site checks, search performance | 6        |

## What was done

**All 106 written by hand**, the same as 719, and for the same reason: the
codemod there produced "Could not load your how your pages do". A name is not a
token to swap. "Purchase orders and deliveries already written keep this unit"
became "Orders and deliveries already written keep this unit"; "you can raise
purchase orders against it" became "you can start sending them orders".

Two fallbacks that only show when a registry lookup fails now fall back to the
Piggles name rather than sparx's: the scanner's name on the label pane, and the
search screen's name on Search Console.

**The guard now reads every surface file against every renamed name.** The two
false positives that forced it narrow are ruled out by structure, not by a list:

1. **A phrase that is still a live Piggles name is never wrong.** "Waiting list"
   is what the Bookings diary calls its queue; "Bills to pay" is Money's own
   screen. `vocabulary.ts` says both out loud, which is WHY the Stock ones were
   renamed. If any screen in this console is called it today, it is a word this
   console uses.
2. **A rename that only changes punctuation is not a rename.** "People &
   equipment" became "People and equipment".

Three more things it had to learn, each found by reading its output:

- **A label map is copy.** The heading "Purchase orders" lives in
  `onboarding-data.ts`, two files from the pane that draws it, and a `.tsx`-only
  scan fixed the sentence underneath while walking past the heading. It reads
  `.ts` now: 18 more.
- **The longest sentence on a pane is the one that DEFINES the thing**, and the
  200-character cut dropped exactly those. Raised to 400: 3 more, including "A
  stock source is something outside Piggles that keeps the count".
- **A sentence with a NUMBER in it is a template literal**, and backticks were
  not in the pattern at all. That is where most counting copy lives: "No
  purchase order has the number 7742", "Find them under Purchase orders to
  review and send", "2 purchase orders still have no date anybody can give".
  Ten more, in seven files. While adding it, the 400-character raise turned out
  to have reached only the single-quoted branch of the same regex, because
  `String.replace` with a string pattern replaces once.
- **The denominator moved from 1,867 to 21,823** because it now reads every
  surface, every data module and every template literal, not only the 48 renamed
  panes.

Two tests pinned the old wording (`price-list-save-words.test.ts`,
`dropship-empty.test.ts`). Both state a rule about WHICH sentence is chosen, not
which words are in it, so the expected strings were updated rather than the
tests weakened.

## Files

- `piggles/scripts/check-screen-names.mjs` — widened
- 55 surfaces and data modules across nine modules
- 2 tests whose expected copy moved with it

## Proof

Put `'on every purchase order…'` back into `custom-fields.tsx`: the check exits 1
naming the file, the line, the sentence and both names. Restored:
`44 renamed screens, 21823 sentences across every surface, and every one calls a
screen what its tab calls it.`

On screen: **Your own columns** heads its last section "Orders to suppliers", and
its empty state reads "it appears on every order you send a supplier". 999 tests
pass, typecheck and ESLint clean.
