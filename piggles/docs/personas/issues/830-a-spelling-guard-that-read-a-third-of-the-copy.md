# 830 — A spelling guard that read a third of the copy

**Status:** fixed
**Severity:** correctness (a guard reporting on more than it looked at)
**Found by:** P03 · Juniper Row · act 281
**Surface:** both consoles, both marketing sites, and the server packages
**Filed:** 2026-09-25
**Fixed:** 2026-09-25
**Confirmed by:** both guards proved red on the defect, then green

## What was on screen

Form settings, under the Name field:

> Leave this empty and replies are **labelled** with the page the form sits on.

`labelled` is British. `labeled` is American, and American spelling is a rule
this repo enforces with two guards, a 203-word list and a pre-push hook. Both
were green.

## Why they were green

`american-spelling.test.ts` reads two things: quoted string literals, and JSX
text with its tags on the same line (`<option>Cancelled</option>`).

**Prettier wraps at 100 characters.** Every sentence longer than a short label
therefore sits on a line of its own, with no tag either side of it:

```tsx
<FieldDescription>
  Leave this empty and replies are labelled with the page the form sits on.
</FieldDescription>
```

That line has no quote and no tag. Neither matcher can see it.

**Measured across both consoles' `surfaces`, `lib/surfaces` and `components`:**

| What the guard reads                         | Lines  |
| -------------------------------------------- | ------ |
| JSX text with its tags on the same line      | 7,412  |
| Prose on a line of its own — read by nothing | 18,244 |

It was reading **29%** of the JSX copy in the console and reporting on all of
it. The same shape one level down in the server check, which reads quoted
literals only: 3,298 more pieces of copy once widened.

[[feedback_structural_checks_go_blind]]

## What widening them found

Five British spellings in the half nobody was reading:

- `piggles/.../builder/form-settings-fields.tsx` — **labelled**
- `sparx/.../commerce/category-detail.tsx` — **neighbours**
- `sparx/.../email/sequence-enrollments.tsx` — **personalise**
- `sparx/.../inventory/product-labels.tsx` — **catalogue**
- `sparx/.../inventory/stock-import.tsx` — **recognises**

and one on the server: **neighbours** in `studio/src/react/theme/board/words.tsx`.

## And a word that was on no list at all

**"enquiry" was not in `scripts/british-words.mjs`.** Over there an enquiry is a
question and an inquiry is an investigation; American English uses "inquiry" for
both. Measured over 6,760 files, **38 lines of copy said it**, including:

- **Customers & enquiries** — a notification group, both consoles
- **New enquiries** — the placeholder on a saved view, both consoles
- _"When someone fills in a form on your site (a contact request, an enquiry, a
  sign-up)"_ — the Form replies empty state, both consoles
- **Website enquiry** — the title the SERVER writes on a deal and the subject it
  writes on a support request, for every website lead
- **Enquiry form** — a silica section's own label, in the builder's Add palette
- eleven paragraphs of sparx marketing, including two verticals pages

A guard whose word list stops growing is a guard that stops finding things. The
list is the ordinary British/American pairs a business console can plausibly
contain, whether or not anybody has typed one yet — and this was a pair nobody
had thought of.

## Four places the British spelling stays, and why

Each one is an identity something else is keyed on. Respelling it would not fix
a spelling, it would silently stop matching. [[feedback_a_copy_edit_breaks_identity_lookups]]

| Where                                          | What it is                                                                  |
| ---------------------------------------------- | --------------------------------------------------------------------------- |
| `funnels/library.ts` `key: 'enquired'`         | A funnel STAGE KEY. `types.ts`: "the identity history is recorded against." |
| `funnels/schemas.ts` `key: 'enquired'`         | The same, in the starter ladders.                                           |
| `silica-catalog` `key: 'enquiry_form'`         | A catalog key, stamped into published pages.                                |
| `verticals/registry.ts` `id: 'tattoo-enquiry'` | An FAQ anchor id.                                                           |

The NAMES beside those keys are what a person reads, and they say "Got in touch"
and "Asked about a slot" — neither contains the word at all.

The search keywords keep **both** spellings and gained the American one, so
somebody who types either still finds the pane. That is the exemption the guard
already documents.

## Two things that had to be fixed to make the widening land

**It timed out.** With 18,000 more lines, a 200-word alternation recompiled per
call took the test past its 5s budget — and vitest reports that as a TIMEOUT,
which reads exactly like a broken guard rather than a slow one. The regex is
built once now, and each file's copy is read once rather than twice (once to
build the alias set, once to scan). 8.3s → 0.96s.

**It flagged three object properties.** `cancelled: 0,` and
`externalId: organisation,` carry no bracket, quote or semicolon of their own, so
"a line with no code punctuation" let them through — and their keys are field
names that must not move. Found by running the new matcher over the server trees
before trusting it.

## Proving both can go red

Put `labelled` back in `form-settings-fields.tsx` and the console test fails
naming the line. Put `neighbours` back in `studio/.../board/words.tsx` and
`check-american-spelling.mjs` exits 1 naming the line. Both were run in that
order before either was believed. [[feedback_a_test_that_cannot_go_red]]

```
 Test Files  1 passed (1)      piggles, 7 tests, 0.96s
 Test Files  1 passed (1)      sparx,   7 tests, 1.00s
check-american-spelling: 2291 server files, 100327 pieces of copy, 206 British words looked for.
```

## Files

- `piggles|sparx/apps/workbench/lib/console/american-spelling.test.ts`
- `scripts/check-american-spelling.mjs`
- `scripts/british-words.mjs`
- 30 copy files across both consoles, both marketing sites and three shared packages

## The thing to remember

**A guard's denominator is the claim, not the verdict.** This one printed "the
words a business owner reads" and read the ones that happened to fit on a line
with their tags. Prettier decided which those were.

Any scanner that matches copy by its SURROUNDINGS is one formatter setting away
from reading a fraction of it. Print the denominator, and when it looks smaller
than the thing being described, that is the finding.
