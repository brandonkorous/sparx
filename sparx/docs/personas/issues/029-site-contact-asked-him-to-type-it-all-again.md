# 029 — Site contact asked him to type it all again

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 2
**Surface:** workbench › Site › "How customers reach you"
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** re-ran P01 act 2 — "Use my business details" filled phone, email and a two-line address
**Blocked on:** —

## What happened

A minute after saving his phone, email and address in Business details, Doty
opened Site and found the same three boxes empty. The name help line also said
"Your legal or billing name is set separately in your account settings", and
there is no "account settings".

## Why it matters

Sites keep their own contact on purpose (one owner can run two businesses), so
copying silently would be wrong. But a first site's owner retypes the same thing,
and the pointer to where the invoice name lives named a place that does not exist.

## The fix (sparx)

- When all three contact boxes are empty and Business details holds any of them,
  the section offers **Use my business details**: it fills the draft (address
  laid out on lines), nothing saves until Save. `contactFromBusiness` in
  `site-identity-data.ts`.
- Help line: "The name on your invoices is set separately, in Business details."

Not made in Piggles: its `site-identity.tsx` is 708 lines, and this is a
convenience, not a defect; touching it would mean splitting that file first.

## Confirmed by

> Re-ran P01 act 2: pressed "Use my business details": (801) 571-7780,
> contact@gillettdiesel.com, "14812 Heritagecrest Way / Bluffdale, UT 84065".
> Saved.

## Rating effect

—
