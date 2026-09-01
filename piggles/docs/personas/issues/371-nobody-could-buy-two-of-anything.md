# 371 — Nobody could buy two of anything

**Status:** fixed
**Severity:** critical
**Found by:** P03 · Juniper Row · walking her own shop as a customer
**Surface:** juniper-row.piggles.site › any product page › the buy box
**Filed:** 2026-09-01
**Fixed:** 2026-09-01
**Confirmed by:** buying three of The Ash Overshirt on her real shop

## What happened

The Ash Overshirt's page carries her own writing, her photographs, the fit notes,
the fabric mill, three colorways. The buy box under it has a size picker, a
Quantity box reading **1**, and **Add to cart**.

The Quantity box could not be changed. Not by clicking in and typing. Not by
selecting the 1 and typing over it. Not with the up-arrow key. Not by clicking
the little spinner arrows, which are drawn, and hoverable, and do nothing.

Every customer of every shop on the platform could buy exactly one of any item,
and nothing on the page said so. There is no error, no disabled styling, no
tooltip. The field looks like a field. It focuses, it takes a ring, the caret
blinks in it. It simply never changes.

Her own copy on that page reads:

> Sizes run XS to XL and I make six of each.

Somebody who wants two of the same tee in different sizes has to buy them one at
a time, each as its own checkout, each paying shipping.

## Why it happened

One word that means two things.

In HTML, `value` is where a control **starts**, and the person using the page owns
it from then on. In React, `value` is what the control is **pinned to** — and a
pinned field with no `onChange` never moves. React says exactly this in the
console:

> You provided a `value` prop to a form field without an `onChange` handler. This
> will render a read-only field.

Her product page is authored as silica nodes, and the buy box's quantity field is
`<input type="number" name="quantity" value="1">`, which is correct HTML. The
storefront then walks that tree to React, translating each attribute to its React
prop on the way:

```ts
for (const [k, v] of Object.entries(safe ?? {})) out[reactAttrName(k)] = v;
```

`reactAttrName` is a table of names React **spells** differently — `tabindex` →
`tabIndex`, `for` → `htmlFor`, `readonly` → `readOnly`. It is a good table and it
could never have caught this, because the danger here is the two spellings being
identical. `value` passed straight through, React took it as controlled state, and
the field froze.

**The codebase already knew.** The older `safeElementAttrs` renderer, which the
legacy builder path uses, does this:

```ts
// A bare `value` on a form input would make it a controlled field (React warns
// without onChange); these are presentational here, so author it as the
// uncontrolled default instead.
if (key === 'value' && CONTROLLED_VALUE_TAGS.has(...)) { out.defaultValue = v; continue; }
```

with a test on it. The newer silica walk was written beside it and did not inherit
any of it.

### Why nothing caught it

- **Two renderers, one tree, different answers.** A silica page body renders as an
  HTML string (`SilicaBody`) unless the template contains a pinned functional core,
  in which case it is walked to React (`SilicaFunctionalBody`). The HTML path has
  no such thing as a controlled input, so the same authored page is editable or
  frozen depending on whether something unrelated is pinned into it. An author
  cannot see that distinction anywhere.
- **The React warning is a dev-only console line.** In production it does not
  exist. Even in dev it sits in a console nobody watching a storefront opens.
- **`wizeworks/apps/site` had no test harness at all** — the one app in the repo
  without one, and the one every tenant's customers buy through. `admin` has a
  vitest seat, the console has a vitest seat, this did not.
- Typecheck, lint and prettier are all green on a frozen field. `value` is a valid
  prop; nothing about it is a type error.

## The fix

The attribute translation moved out of `silica-chrome.tsx` into its own module,
`components/silica-attrs.ts`, and gained the case it was missing:

```ts
const UNCONTROLLED: Record<string, string> = {
  value: 'defaultValue',
  checked: 'defaultChecked',
};
```

`checked` is the same bug wearing a different name and is fixed with it — a
checkbox authored as pre-ticked would have been un-tickable in the same way.

**A radio or checkbox keeps its `value`.** There it is the payload the form
submits rather than the state of the control, so React neither freezes it nor
complains — and the variant picker on every product page depends on that value
arriving intact. Remapping it wholesale would have broken size selection while
fixing quantity.

Its own module for two reasons: it is its own job, and `silica-chrome.tsx` is a
server component that cannot be exercised without React and a DOM, while a lookup
table can be exercised with neither.

**`wizeworks/apps/site` now has a test seat**, matching `wizeworks/apps/admin` and the console —
a plain-object `vitest.config.ts` (not `defineConfig`, which cannot load before an
install) and `"test": "vitest run --passWithNoTests"`. Nineteen tests on the
translation; four go red against the old table.

`vitest` is a new devDependency of `apps/site`; the install has been run, and the
app now typechecks and tests clean on its own.

## Confirming it

On her real shop, as a customer, at `/products/the-ash-overshirt`:

| Step                       | Before                       | After                               |
| -------------------------- | ---------------------------- | ----------------------------------- |
| Select the 1, type `3`     | still 1                      | 3                                   |
| Up-arrow key three times   | still 1                      | steps up                            |
| Click the spinner arrow    | still 1                      | steps up                            |
| Pick M · Clay, Add to cart | cart (1), $128.00            | **cart (3), M · Clay, $384.00**     |
| React console              | the read-only warning, twice | clean, and the dev issue badge gone |

Also confirmed unchanged in the same pass: **XS · Bone is struck through, labeled
"sold out" and genuinely `disabled`** — the size picker's own handling of the size
issue 370 was about is correct, and this fix did not disturb it.

## Still open

- **The two render paths still disagree in kind.** One page tree, two renderers,
  and which one runs depends on whether a functional core happens to be pinned
  into the template. This particular divergence is closed; the shape that produced
  it is not, and the same class of bug can appear at any attribute the two paths
  treat differently. A shared conformance test — render the same tree both ways,
  diff the resulting DOM — is the real answer and is its own piece of work.
- **`<option selected>` is allowed by the sanitizer and unhandled by the walk.**
  React ignores `selected` on an option and logs an error pointing at the parent
  `<select>`'s `defaultValue` instead. Nothing in the catalog authors it today —
  the Select atom expands a newline-separated `options` string with no default —
  so this is reachable only if an author gains a way to mark a default. Named
  rather than fixed, because building the hoist for a state nothing can currently
  produce is machinery with no case behind it.
