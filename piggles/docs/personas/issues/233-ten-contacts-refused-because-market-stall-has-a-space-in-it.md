# 233 — Ten contacts refused because "market stall" has a space in it, and the practice run had said it was fine

**Status:** fixed and confirmed
**Severity:** high
**Found by:** P03 · Juniper Row · act 8 — importing her mailing list for real
**Surface:** mypiggles › Home › Get set up › Move in from somewhere else
**Filed:** 2026-08-26
**Fixed:** 2026-08-26
**Confirmed by:** P03 · Juniper Row · act 8 — same file, same button: 9 new, 16 updated, **0 errors**, 25 addresses and 25 tag sets landed

## What happened

Devi ran the practice run. It said what she wanted to hear:

> **Practice run finished — nothing was saved**
> Customers · 25 of 25 would come over
> This is exactly what a real import would do. Run it for real when you are ready.

She ran it for real. **Fifteen landed and ten were refused.** The reason, as
recorded against each rejected row:

```json
[
  {
    "origin": "string",
    "code": "invalid_format",
    "format": "regex",
    "pattern": "/^[a-zA-Z0-9_-]+$/",
    "path": ["tags", 1],
    "message": "Tags must be alphanumeric (plus _ and -)"
  }
]
```

Ten of her twenty-five contacts are tagged **`market stall`**, **`gift guide`**
or **`made to order`**. The tags have spaces in them.

## What should have happened

They import. "market stall" is what a tag IS to the person writing it.

## Why it matters

Three separate failures, in descending order of how bad they are.

**The rule was wrong.** `^[a-zA-Z0-9_-]+$` describes a slug. Nobody writing a tag
on a customer is writing a slug — they are writing two words in English, the way
they would say it out loud. This is a product whose users are non-technical
business owners, and it refused a shop's own vocabulary.

**The practice run lied.** Its entire promise is "this is exactly what a real
import would do", and it reported zero problems for a file that was about to lose
40% of its rows. A practice run that can be wrong is worse than no practice run,
because it converts caution into false confidence.

**And the explanation was a JSON dump.** `"origin": "string"`,
`"pattern": "/^[a-zA-Z0-9_-]+$/"`. That went straight into the run report under
"Worth knowing", where a shop owner reads it. There is nothing she can do with it.

Compounding all three: the import is a **partial**. Fifteen in, ten missing, and
nothing on the screen names which ten or says the word "tag".

## Where it lives

**The rule.**
[common.ts](../../../../wizeworks/packages/crm-schemas/src/common.ts):

```ts
.regex(/^[a-zA-Z0-9_-]+$/, 'Tags must be alphanumeric (plus _ and -)')
```

The comment above it justifies only the LENGTH cap (mirroring `VARCHAR(63)`). The
regex was never explained, and nothing needed it: the only filter over tags is
`tags: { has: value }`, an exact parameterised array match that is indifferent to
spacing.

**The preview.** `customers` previewed create-vs-update and never asked whether
the write would ACCEPT the row.

**The message.** The write path did
`err instanceof Error ? err.message : String(err)`, and a `ZodError`'s `.message`
is a JSON array.

## The fix

**A tag may contain a space.** Trimmed, 1–63 characters, and two things still
refused, both for a stated reason:

- **A comma**, because tags arrive from a spreadsheet as one comma-separated
  cell, so a tag containing a comma cannot survive the round trip and would
  silently split in two. `"A tag cannot contain a comma. Commas separate tags."`
- **Hidden characters**, which are never intended.

**The preview runs the write's own validation.** A new
[customer-input-check.ts](../../../../wizeworks/packages/crm/src/services/customer-input-check.ts)
answers "would creating this contact be refused, and what would I tell them?" by
parsing with the SAME schema `customerService.create` parses with. It lives beside
the schema rather than in the importer precisely so a copy cannot drift — drift
here means the practice run going back to lying.

**And the refusal is a sentence.** The same helper renders a failure as
`Tags: A tag cannot contain a comma. Commas separate tags.` — the column she
recognises, and words. Both the preview and the write use it, so they cannot
diverge.

## What it looked like once fixed

Same file, same two buttons:

```
practice run   25 rows   9 new · 16 already here · 0 problems
real import    25 rows   9 imported · 16 updated · 0 errors
```

The numbers now agree, which is the actual repair. And the data arrived whole:

```
customers 29   with a phone 21   with tags 25   addresses 25
```

Including `{newsletter,"made to order"}` on Anneliese and `{"market stall"}` on
Beatriz.

## Related

The same file's columns had to survive detection first —
[228](228-it-told-her-the-file-was-from-a-platform-she-has-never-used.md) — and
be given somewhere to land — [230](230-the-mapper-offered-a-home-for-her-addresses-and-nothing-wrote-them.md).
The preview's create-vs-update half is [231](231-the-practice-run-checked-nothing-against-what-she-already-had.md).
A JSON blob shown where a sentence belongs is the same shape as
[224](224-the-server-explained-the-problem-and-the-screen-said-check-what-you-entered.md).

## Rating effect

`Home › Move in` in [rating.md](../rating.md). Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
