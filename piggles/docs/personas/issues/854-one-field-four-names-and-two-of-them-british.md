# 854 — One field, four names, and two of them British

**Status:** fixed
**Severity:** **minor** on any one screen, **moderate** together — her checkout
says one word to her customers and her own import screen says another, on an
American platform, about an American address
**Found by:** P03 · act 299, while the console was waiting for a sign-in code
**Surface:** mypiggles › Import, Stock locations, the CSV error message, and two
free tools on the marketing site
**Filed:** 2026-09-28
**Fixed:** 2026-09-28
**Confirmed by:** the repo-wide spelling guard, run red and then green, plus a
new test over the column matcher

## The same box, four different names

| where                            | said                  |
| -------------------------------- | --------------------- |
| her checkout, her customers see  | Postal code           |
| her business details             | Postal code           |
| her customer and order addresses | Postal code           |
| **her import mapping screen**    | **Postcode**          |
| **a rejected import row**        | **"Postcode: …"**     |
| **her stock location form**      | **"Postcode or ZIP"** |
| a marketing page mock checkout   | ZIP                   |

Twenty-two screens had settled on **Postal code**. Seven had not, and one had
hedged by printing both.

"Postcode" is the British word. Devi Raman runs a clothing business in America.
[[feedback_american_spelling]]

## Why the guard was green about it

`scripts/check-american-spelling.mjs` scans 5,561 files and 310,000 pieces of
copy for 206 British words, and it passed. Its own header names the exact file
this was sitting in:

> The column labels on an import are in `migration/src/canonical.ts`.

It was reading that file. It simply did not know the word. `postcode` was not one
of the 206.

A guard pointed at the right file, running on it, and blind.
[[feedback_structural_checks_go_blind]]

## The thing that made this more than a spelling

**The label is a lookup key.** `guessMapping` matches a heading from somebody's
spreadsheet three ways:

```ts
if (normalize(field.key) === wanted) return true;
if (normalize(field.label) === wanted) return true;     // ← the words on screen
return (ALIASES[field.key] ?? []).some(...);
```

So renaming a label changes what auto-fills on an import. Checked before editing
rather than after. [[feedback_copy_edit_breaks_identity_lookups]]

- `zip` was safe: its alias list already held `'postcode'`, `'postal code'` and
  `'zip code'`, so both spellings matched before and after.
- `ship_zip` was **not**. It had no aliases at all, so its label
  `"Ship to postcode"` was the only thing matching that header. Renaming it
  would have quietly stopped a file headed that way from filling itself in.

So the aliases came first, then the rename. Both spellings are listed, the way
every other alias in that list already does it.

## Two words that stayed British on purpose

**The connectors.** BigCommerce's export column is literally `Zip/Postcode`,
WooCommerce's is `Postcode`, Magento's field is `_address_postcode`. A connector
has to say the word that is in the file it was handed. Listed in the guard by
file and word, so a second file saying it is still a defect.

**The two marketing tools' stored keys.** The business card maker and the
structured data tool save their form to the visitor's own browser, and the
storage hook **replaces** its whole object with whatever it finds rather than
merging over the default. Renaming the key would read an older saved card back
with nothing in that field, turn a controlled input uncontrolled, and blank it
for anybody who had used the tool before. The label moved; the key did not, with
a comment beside it saying why so the next sweep leaves it alone.
[[feedback_a_fix_leaves_its_neighbour_behind]]

## Proved

**8 tests** in a new `column-guess.test.ts`, and **proved red twice**:

| what was broken                       | went red |
| ------------------------------------- | -------- |
| removing the `ship to postcode` alias | 1 of 8   |
| running the alias round first         | 2 of 8   |

The guard was proved red the same way: adding `postcode` to the word list turned
a green run into **11 findings**, which is how the seven real ones were found
rather than guessed at.
[[feedback_a_test_that_cannot_go_red]]

**Checks:** typecheck 0 on `@wizeworks/migration`, `@wizeworks/crm`, both
workbenches and the piggles marketing site. Guards `american-spelling`,
`console-parity`, `em-dashes`, `plain-words` all green. The two consoles'
`guessMapping` are byte-identical. ESLint and prettier clean.

## Files

- `scripts/british-words.mjs` (`postcode` → `postal code`)
- `scripts/check-american-spelling.mjs` (the three connectors exempted by file and word)
- `wizeworks/packages/migration/src/canonical.ts` (4 labels)
- `wizeworks/packages/crm/src/services/customer-input-check.ts` (the CSV error message)
- `{piggles,sparx}/apps/workbench/surfaces/migration/column-guess.ts` · `column-mapper.tsx` (the aliases)
- `piggles/apps/workbench/surfaces/migration/column-guess.test.ts` (new)
- `piggles/apps/workbench/surfaces/inventory/location-address.tsx`
- `sparx/apps/workbench/surfaces/inventory/location-detail.tsx`
- `piggles/apps/web/components/marketing/tools/digital-card-tool.tsx`
- `piggles/apps/web/components/marketing/tools/structured-data-tool.tsx`

## The thing to remember

**"Postcode or ZIP" is the shape of a decision nobody made.** One screen printed
both words rather than pick one, and that is the tell: somebody knew the platform
disagreed with itself and wrote the disagreement onto the form instead of
settling it. A label that hedges is a label that lost an argument with nobody.

And the smaller one: **a word list is a vocabulary, not a rule.** The guard was
not wrong, not stale and not misconfigured. It was reading the right file and did
not know the word, which is the failure mode a green check cannot show you. Every
word added to it costs nothing; every word missing from it is invisible.
