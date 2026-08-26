# 238 — She imported a mailing list and got contacts instead

**Status:** fixed and confirmed; proven by test, not yet re-run on her own data
**Severity:** high
**Found by:** P03 · Juniper Row · act 8 — the built-in Newsletter Subscribers group
**Surface:** mypiggles › Home › Get set up › Move in from somewhere else
**Filed:** 2026-08-25
**Fixed:** 2026-08-25
**Confirmed by:** P03 · Juniper Row · act 8 — her own file re-imported on screen: 22 consented, 3 refused, 0 invented dates

## What happened

Devi's spreadsheet has an **Accepts Marketing** column. The column mapper offered
"Email opt-in", matched it, and she confirmed it. Twenty-five contacts imported
with no errors.

The built-in **Newsletter Subscribers** group — the one whose entire purpose is
the list she just imported — has nobody in it. Not because it was stale
([234](234-every-group-of-customers-was-empty-and-the-bridge-said-nobody-wanted-these.md),
[235](235-she-imported-twenty-five-people-and-they-joined-nothing.md)), but because
after those were fixed it still cannot match anybody:

```
customers  29    contactable  26    marketing consent  0
```

Twenty-six people the software will happily contact, and not one of them subscribed.

## What should have happened

An explicit yes in the opt-in column is what makes somebody a subscriber. That is
what the column means, on every platform that exports it, and it is what an owner
is asserting when she maps it.

## Why it matters

She imported a mailing list **in order to email it**. Everything about the import
reported success — twenty-five rows, no errors, the opt-in column mapped and
confirmed — and the one capability she did it for is missing, on a screen two clicks
away that says "No members yet" without explaining itself.

The near-miss underneath it is worse: every contact shows as **contactable**. A
person reading the customer list would conclude the opt-in landed.

## Where it lives

The importer read the column for one thing:

```ts
...(row.accepts_marketing !== undefined
  ? { doNotContact: doNotContactFrom(row.accepts_marketing) }
  : {}),
```

`do_not_contact: false` says **nobody has objected**. It is not permission. Being
subscribed is:

```ts
const hasMarketingConsent = Array.isArray(consent.scope) && consent.scope.includes('marketing');
const subscribed = hasMarketingConsent && !customer.doNotContact;
```

and `gdpr_consent` was left at `{}` for every imported row. The schema has carried
`source: 'import'` as a valid value since it was written; nothing ever wrote it.

## The fix

An explicit yes now writes the consent record as well as clearing the flag. The
asymmetry the file already documents governs both, from one shared predicate so
they cannot disagree about what the cell said:

> a contact wrongly marked no can be asked again, and a contact wrongly marked yes
> is an unlawful send the tenant finds out about from a complaint

- **yes / subscribed / opted in** → `scope: ['marketing']`, `source: 'import'`
- **no**, or a word from somebody else's platform → blocked, no consent
- **blank** → contactable, but not subscribed. Not a refusal, and not permission.

**No `grantedAt`.** The file does not say when they agreed; stamping the import time
would put a date on something nobody measured. `source` records the part we know.

**Consent is only ever added, never removed, on a re-import.** A later file saying
no blocks the send, which is what matters — but erasing the record of a consent
someone gave would destroy the evidence for mail already sent under it.

## What it looked like once fixed

Three tests, red without the change:

```
a mailing list arrives as a mailing list
  ✓ records marketing consent for the people who said yes, and only them
  ✓ says where the consent came from, and does not invent a date for it
  ✓ never revokes a consent already on file when the same list is imported again
```

## What is NOT done

**Devi's own twenty-nine still have no consent, and no migration will give them
any.** Inferring consent from `do_not_contact = false` would be inventing it — the
flag has never meant permission, which is the whole defect. The remedy is to import
the file again, which the fix makes work; the importer treats it as an update and
adds the record.

That re-run is the one step of this not yet confirmed on screen: the browser window
kept dropping to the background, which silently discards clicks, and the run never
started. The behaviour is proven by test and the mechanism was read directly out of
the database; **the re-import as Devi is still owed.**

## Related

The same import's other repairs are
[230](230-the-mapper-offered-a-home-for-her-addresses-and-nothing-wrote-them.md),
[231](231-the-practice-run-checked-nothing-against-what-she-already-had.md) and
[233](233-ten-contacts-refused-because-market-stall-has-a-space-in-it.md). A value
already in the software's hand that nothing records is the same shape as
[230](230-the-mapper-offered-a-home-for-her-addresses-and-nothing-wrote-them.md).

## Rating effect

`Home › Move in` and `Customers › Groups` in [rating.md](../rating.md). Recorded in
the run log of [03-juniper-row.md](../03-juniper-row.md).

## Confirmed on her screen

Devi re-ran her own file. The mapper read 11 of 11 columns, with **"Accepts
Marketing" → "Email opt-in"**, and reported _"Customers 25 of 25 brought over."_
In her records afterwards:

|                         |        |
| ----------------------- | ------ |
| marketing consent       | **22** |
| `source: 'import'`      | **22** |
| an invented `grantedAt` | **0**  |
| do-not-contact          | **3**  |

Exactly the file's 22 yes and 3 no, and no duplicates — 29 contacts before and
after. The re-import this issue said was still owed has now been done.

What it exposed is
[240](240-she-imported-her-mailing-list-and-the-mailing-list-group-stayed-empty.md):
with consent finally correct, "Newsletter Subscribers" was STILL empty, for an
entirely separate reason.
