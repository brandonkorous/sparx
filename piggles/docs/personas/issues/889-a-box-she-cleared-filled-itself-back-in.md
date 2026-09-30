# 889 — A box she cleared filled itself back in

**Status:** fixed
**Severity:** **moderate** — an edit she made on purpose was discarded and the
screen said "Saved". Nothing warned her, nothing was marked, and the old value
was back in the box she was looking at. On the same form a required box could be
emptied and saved, which broke the connection in a way the pane then described
wrongly
**Found by:** P03 · act 316, working through Partners by data weight
**Surface:** mypiggles › Partners › Ship-direct suppliers › a supplier's own
pane, in both consoles
**Filed:** 2026-09-30
**Fixed:** 2026-09-30
**Confirmed by:** 16 tests, proved red three ways including the over-fix that
would wipe a working API key; and her own screen, before and after

## What she saw

Highline Knitwear (Denver), a CSV feed. She emptied **Column: Cost price** and
pressed Save.

```
bottom left     Saved just now
the box         wholesale_price
```

The value came back. No error, no warning, no mark on the field. Just "Saved"
and the thing she deleted sitting there again.

## One bag, one rule, twenty-three fields

```ts
// Only send credential fields that were actually typed — a blank field keeps
// the stored secret (the API merges what it receives over the stored bag).
const typedCredentials = Object.fromEntries(
  Object.entries(draft.credentials).filter(([, v]) => v.trim() !== '')
);
```

The comment is right about what it is for. A `password` box is never drawn back
to her, so it is blank on every visit, and sending that blank would wipe a
working API key every time she changed the supplier's name. Blank must mean
"leave it alone".

It is wrong about every other field. Across the whole vendor catalog there are
**4 password fields and 19 plain ones** — a store id, a shop id, a feed address,
and fifteen spreadsheet column names. Every one of those is drawn in full, so
clearing one is a decision, and dropping it silently is the screen overruling
her. [[feedback_honor_the_users_choice]]

## The same split, already made, on the way out

`nonSecretCredentials` in the REST route had already found this, on the other
half of the same round trip, and says so in a doc comment:

> _"'Credentials' is one bag and it was returned as one bag: nothing. That is
> right for the four `password` fields across the catalog and wrong for the
> other NINETEEN, which are a store id, a shop id, a feed address and fifteen
> SPREADSHEET COLUMN NAMES."_

The trip out was split on `type === 'password'`. The trip back was still one
bag. [[feedback_a_fix_leaves_its_neighbour_behind]]

And the field spec the form needs was already on the wire. Its own comment says
why it is there:

> _"`VendorCredentialField` — fetched, never hardcoded, so the form can never
> drift from what the adapter actually needs."_

It carries `type` and `required`, and the save path read neither.
[[feedback_fetched_but_never_rendered]]

## The second half: a required box that could be emptied

```ts
const missingCredential =
  isNew && vendor
    ? credentialFields.find((f) => f.required && …)
    : undefined;
```

**`isNew &&`.** The required-field check ran on a NEW supplier only, and so did
the red marker on the box itself. On an existing one, every required column
could be cleared and saved.

The guard was not careless. On an edit the draft holds only the boxes she has
TOUCHED, so an absent key means "unchanged" — reading absent as empty would have
marked all five required boxes red the moment she opened the pane. The fix is to
tell the two apart rather than to skip the check:

```ts
if (!isNew && !(field.key in draft)) return false;
```

Absent is unchanged. Present and blank is a box she emptied on purpose.

## Why the second half mattered

`CsvSupplierAdapter.syncCatalog` checks the mapping **before it fetches
anything**:

```ts
if (!mapping.supplierProductId || !mapping.title || !mapping.sku || !mapping.costPrice) {
  throw new Error('CSV column mapping is incomplete: …');
}
```

The worker catches any failure and writes `status: 'error'` with no reason, and
the pane then prints one sentence for the whole class:

> _"We could not read this supplier's file. Check the address is right and that
> the file opens for anybody, not just for people signed in to their system."_

So clearing a column sent her to check a URL that was perfectly correct, about a
file that had never been fetched, while the answer sat in a text box 200 pixels
below the sentence she was reading. That the advice is a single guess for
several different failures is **filed separately as issue 890** — this issue
closes the one cause a person can reach from this screen.

## What it does now

Three rules, in `dropship-data.ts` where both the bar and the boxes read them:

- `credentialsToSend` — a blank is sent for anything she can SEE, and kept for a
  `password`. A key this build does not recognize is treated as a secret,
  because wiping something we cannot name is the worse of the two mistakes.
- `credentialIsMissing` — one field, aware of new versus edit.
- `missingRequiredCredential` — the first one, for the bar at the top, built on
  the same predicate so the bar and the box cannot disagree.

The sentence in the bar also stopped reading **"Enter the column: cost price: it
is needed to connect."** It quotes the label verbatim now, so she can scan the
form for the box: **`"Column: Cost price" is needed to connect.`**

Both consoles.

## Proved

**16 tests**, and three wrong versions:

```
drop every blank (the original)          →  4 fail
send every blank, secrets included       →  4 fail
required check on new suppliers only     →  2 fail
```

The second is the one worth having. "Just send what she typed" is the obvious
fix, it makes the column mappings behave, and it wipes a working API key on the
next save of anything at all. The catalog's own `type` is what separates them,
and it was already on the wire. [[feedback_a_test_that_cannot_go_red]]

A last test walks every field in both shapes and asserts the two halves agree:
if a blank value is going to be SENT for a field, and that field is required,
the form owes her a sentence about it before she presses Save.

**Checks:** piggles console 171 files / 1606 tests, sparx workbench 140 / 1288,
both fully green. Typecheck 0 on both. ESLint and prettier clean.

**On her own screen:** emptying Column: Cost price now disables Save, marks the
box, and says `"Column: Cost price" is needed to connect.` Emptying Column:
Description saves, and the box is still empty when the pane reopens.

## Files

- `piggles/apps/workbench/surfaces/dropship/dropship-data.ts`
- `sparx/apps/workbench/surfaces/dropship/dropship-data.ts`
- `piggles/apps/workbench/surfaces/dropship/supplier-detail.tsx`
- `sparx/apps/workbench/surfaces/dropship/supplier-detail.tsx`
- `piggles/apps/workbench/surfaces/dropship/credential-blanks.test.ts` (new)
- `sparx/apps/workbench/surfaces/dropship/credential-blanks.test.ts` (new)

## Measured

```
credential fields across the whole vendor catalog     23
  · type: password  (a blank means "keep")             4
  · type: text or url  (a blank means blank)          19      83%
```

## Test data left in place

Highline Knitwear now carries `mapDescriptionColumn: ""` where it previously had
no such key. The two are identical to the adapter, which reads any empty mapping
as unset; the empty string is the record of the clear that finally stuck.

## What I got wrong on the way

I read the `isNew &&` guard, worked out that a required column could therefore
be blanked, and went to prove it on screen — expecting the save to land. It did
not: the value reappeared. The guard was real, but the chain I had reasoned out
was broken one link earlier by a filter I had not read yet, and the actual
defect was the silent revert I only saw because I clicked.
[[feedback_test_as_a_business_owner]]

## The thing to remember

**A rule written for the one field nobody can see was applied to the
twenty-two people can.** The comment above it was accurate, the reasoning behind
it was sound, and it was generalized one step too far — the step where it stops
being about secrets and starts being about "credentials", which is a storage
bag, not a kind of thing.

The measurement that finds it is not "does this save work" — it does. It is
**"what is different about the field this rule was written for, and does that
difference hold for the others?"** Here the catalog already carried the answer
in a `type` column, and two of the three places that needed it were reading it.
