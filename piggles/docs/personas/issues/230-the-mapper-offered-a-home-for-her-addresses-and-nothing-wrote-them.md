# 230 — The mapper offered a home for her addresses and nothing wrote them

**Status:** fixed and confirmed
**Severity:** high
**Found by:** P03 · Juniper Row · act 8 — reading the importer after the mapping landed
**Surface:** mypiggles › Home › Get set up › Move in from somewhere else
**Filed:** 2026-08-26
**Fixed:** 2026-08-26
**Confirmed by:** P03 · Juniper Row · act 8 — 25 contacts imported, **25 addresses** on file

## What happened

Devi's spreadsheet carries Address, City, State, Zip and Country. The column
mapper offered "Address line 1", "City", "State / region", "Postcode" and
"Country", matched all five, and showed her the count: 25 ready.

Nothing wrote them. Not one street address reached a customer record.

## What should have happened

The address on the row becomes the customer's address.

## Why it matters

She is importing her customer list so she can reach her customers. An address is
half of what that means — it is how a parcel gets posted. She assigned the
columns herself, on a screen that asked her to, and the software took the
assignment and dropped it.

This is the worst version of the shape: not a field she forgot, a field she was
invited to fill in.

## Where it lives

[customers.ts](../../../../wizeworks/services/import-worker/src/processors/customers.ts)
lists them in `RESERVED_COLUMNS`:

```ts
'address1', 'address2', 'city', 'province', 'country', 'zip',
```

`RESERVED_COLUMNS` means "the mapping above already owns these" — it stops them
being swept into `custom_properties`. But the mapping above did NOT own them:
`processCustomerRows` reads email, first/last name, company, phone, job title,
type, tags and marketing consent, and never touches an address.

So the columns were claimed by the one mechanism that would have caught them and
then handled by nothing. Reserved, and dropped.

The canonical schema had a home for every one of them all along
([canonical.ts](../../../../wizeworks/packages/migration/src/canonical.ts)), and
so does the database — `customer_addresses` with a service that writes it.

## The fix

The processor writes the address through `customerService.addAddress`, as the
customer's default, for both `shipping` and `billing`.

Three decisions worth stating:

- **On an existing customer it is added only when they have none.** Their address
  book is theirs, and a file imported twice must not leave the same street on file
  three times.
- **The country is resolved from what a person would type.** `CreateCustomerAddressInput`
  takes ISO alpha-2 only, so without this the whole address is refused over the
  words "United States". A short table covers the common spellings; anything else
  is NOT guessed at.
- **A partial address does not fail the contact.** If there is no street line, no
  town, or a country we cannot resolve, the contact still lands and the row
  carries a note saying the address did not — which is exactly what `RowResult`'s
  `errorMsg` is documented to be for on a non-error row. Losing a customer over an
  incomplete address would be a worse trade than the one this fixes.

## What it looked like once fixed

```
customers 29    addresses 25
```

Marguerite Adeyemi: `1184 SE Ash St, Portland, OR 97214, US`.

## Related

The columns only reached the mapper because detection stopped guessing —
[228](228-it-told-her-the-file-was-from-a-platform-she-has-never-used.md).

## Rating effect

`Home › Move in` in [rating.md](../rating.md). Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
