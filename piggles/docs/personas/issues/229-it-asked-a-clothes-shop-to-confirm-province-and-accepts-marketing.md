# 229 — It asked a clothes shop to confirm `province` and `accepts_marketing`

**Status:** fixed and confirmed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 8 — mapping her own columns
**Surface:** mypiggles › Home › Get set up › Move in from somewhere else › Tell us what this file is
**Filed:** 2026-08-26
**Fixed:** 2026-08-26
**Confirmed by:** P03 · Juniper Row · act 8 — the same eleven rows now read "First name", "Address line 1", "State / region", "Postcode", "Email opt-in"

## What happened

The column mapper asks Devi to confirm what each of her columns means. It had
already guessed all eleven, so her job was to read them and agree. This is what
it showed her:

```
What is in this file?     customers

Your columns
  First Name          →  first_name
  Address             →  address1
  State               →  province
  Zip                 →  zip
  Accepts Marketing   →  accepts_marketing
```

`province`. `accepts_marketing`. `address1`. Lowercase, underscored, and in one
case a word Americans do not use for the thing it names — Devi's column says
**State**, and the software answered **province**.

## What should have happened

"State / region", "Email opt-in", "Address line 1", "Postcode", "Customers". The
schema already carries exactly those words.

## Why it matters

This screen exists to be READ. It is the one moment where a person confirms that
the software understood their file, and it is asking them to check a mapping
written in a vocabulary they have never seen. Someone who cannot tell whether
`province` is right will click through anyway, which turns the confirmation step
into a formality — and this screen is the last thing standing between a
mis-mapped column and a customer list with the postcode in the county field.

Piggles' first rule about words is that a shop owner should never have to learn
a developer's vocabulary to run their business.

## Where it lives

The labels were never missing. `ENTITY_FIELDS` in
[canonical.ts](../../../../wizeworks/packages/migration/src/canonical.ts) carries
one for every field:

```ts
{ key: 'province', label: 'State / region', kind: 'text', max: 128 },
{ key: 'accepts_marketing', label: 'Email opt-in', kind: 'boolean' },
```

And [column-mapper.tsx](../../../../piggles/apps/workbench/surfaces/migration/column-mapper.tsx)
rendered them into its options:

```tsx
<option key={field.key} value={field.key}>
  {field.label}
</option>
```

The options were right. **The trigger was not.** Silica's `Select` is a Base UI
listbox, not a platform `<select>` — it takes a value→label map on `items` and
paints the closed control from THAT. With no `items`, it has nothing to look the
value up in, so it prints the value: `province`.

Opening the dropdown showed the proper labels the whole time, which is why this
survived: the fault only appears when the control is shut, which is how it is
99% of the time.

## The fix

Pass `items` to both Selects — one map for the entity, one for the fields, built
from the labels already on the schema.

The one call site in the console that was missing it. `ai-connections.tsx` and
`chat/settings.tsx` are the only other places that pass raw `<option>` children,
and both already supply `items`.

## What it looked like once fixed

```
What is in this file?     Customers

Your columns
  First Name          →  First name
  Address             →  Address line 1
  State               →  State / region
  Zip                 →  Postcode
  Accepts Marketing   →  Email opt-in
```

## Related

She only reached this screen because the detector stopped guessing —
[228](228-it-told-her-the-file-was-from-a-platform-she-has-never-used.md).

## Rating effect

`Home › Move in` in [rating.md](../rating.md). Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
