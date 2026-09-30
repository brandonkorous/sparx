# 731 — The guard could not read a wrapped line

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 259
**Surface:** `piggles/scripts/check-screen-names.mjs`, and the 20 sentences it was not reading
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on the screen: the price sheet's last button reads "Retire this special price"
**Blocked on:** —

## What happened

At the bottom of the trade price sheet, under a tab reading **Trade sheet 2026**
and a list called **Special prices**, the last button said:

> Retire this price **list**

`check:screen-names` was green. It had been green through
[723](723-the-other-half-of-the-rename.md), which is the issue that exists to
catch exactly this sentence.

## Why it matters

The guard's JSX branch was:

```js
/…|>([^<>{}\n]{8,400})</g;
```

`[^<>{}\n]` excludes the newline. Prettier wraps any label that does not fit
beside its tag onto its own line, which is most of them:

```jsx
<Button …>
  Retire this price list
</Button>
```

so the text node BEGINS with a newline and a branch that stopped at one never
started. **MEASURED 2026-09-19: it was reading 3,939 JSX text nodes out of
9,250. 5,311 were invisible** — and not a random 5,311, but the LONG half, the
ones Prettier had to wrap, which is where a sentence naming a screen lives.
[[feedback_structural_checks_go_blind]]

## And the guard was misreporting the ones it did read

[729](729-a-name-the-brand-could-not-reach.md) added `PIGGLES_CREATE_LABELS` to
`vocabulary.ts`, keyed the same way as `PIGGLES_SURFACES`. `pigglesTitles()`
read the whole file with one regex, so a create label overwrote a name:
**Orders to suppliers** came back as **New order**, and every breach in a
purchase order file was reported against a button instead of a tab.
[[feedback_a_fix_leaves_its_neighbour_behind]]

## What was done

**The JSX branch allows a newline.** `<`, `>`, `{` and `}` still end the node,
so it is a text node and never a span of code. The denominator went from 21,827
sentences to **24,162**.

**`pigglesTitles()` reads only PIGGLES_SURFACES**, by slicing the file between
the two map names, and exits loudly if either is gone.

**Twenty breaches, all hand-written.** Every one of them on a screen whose tab
already says something else:

| the body said            | the tab says        | where                               |
| ------------------------ | ------------------- | ----------------------------------- |
| Retire this price list   | Special price       | the price sheet                     |
| a price list gives…      | Special price       | the price sheet, new                |
| trade price lists        | Special prices      | a product's prices, ×2              |
| your price lists         | Special prices      | a company, cost settings            |
| under Price tiers        | Wholesale prices    | a wholesale customer                |
| New product type         | Kind of product     | a product's details                 |
| Raising a purchase order | Orders to suppliers | Waiting for stock, ×2               |
| the purchase order       | Orders to suppliers | a delivery scan, a bill, a supplier |
| New purchase order       | Orders to suppliers | the list's own button               |
| sample data              | Practice data       | a return, and its own button        |

**Three false positives were ruled out**, two of them structurally:

- **A rename that ADDED words did not take the old phrase away.** "What matters"
  became "What matters most", so "Describe what matters, not 'image of'" is this
  console's own words and always was. Only a rename that REPLACES a phrase keeps
  one away. That rule also covers "Units" → "Units of measure" and "Move in" →
  "Move in from somewhere else".
- **A word a STANDARD owns, on the one screen that teaches the standard.**
  "Record type" is what RFC 1035 calls the kind of a DNS entry, and the domain
  screen has to say it because that is the word on the registrar's form the
  reader is about to open. Named by file, beside the existing
  `Search Console` exemption, so it cannot spread.

## Files

- `piggles/scripts/check-screen-names.mjs` — the newline, the map slice, two rules
- 15 surfaces

## Proof

Put `\n` back in the JSX branch: the denominator drops to 21,827 and all 20
breaches go unseen. Restored: `43 renamed screens, 24162 sentences across every
surface, and every one calls a screen what its tab calls it.`

On screen: the last button on the trade price sheet reads **Retire this special
price**. 1,010 piggles tests and 880 sparx tests pass; both typechecks and
ESLint clean.
