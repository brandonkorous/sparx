# 137 — The search box finds three screens and says nothing about Rob

**Status:** fixed (the silence); **open** (the empty index)
**Severity:** major
**Found by:** P02 · Halo & Hem · act 10
**Surface:** mypiggles › the search box in the bottom bar
**Filed:** 2026-08-22
**Fixed:** 2026-08-22
**Confirmed by:** see below

## What happened

Act 10's fourth job was "look up Rob's last visit". On a phone the search box is
the obvious route, so: tap the magnifier, type **Rob**. Three results:

> **Home**
> What you told us
> Send feedback
> **Get Found**
> Things worth fixing

Rob Alvarez — a customer with an email, a phone number, an order today and an
appointment on Friday — was not among them, and nothing on the screen said he had
been looked for. The three that came back matched because the letters r-o-b sit
inside the word **problem**, which is a keyword on all three.

The only reading available to Nia is that Piggles has never heard of Rob.

## The two halves

**1. The palette never reports the record half.** It searches two things at once
— the screens in this console and the records in the business — and only one of
them ever spoke. `LauncherEmpty` renders only when the WHOLE list is empty, so
three coincidental screen matches were enough to hide the fact that the record
search ran and found nothing. An absent answer rendered exactly like a correct
one, which is the shape this repo keeps meeting.

**2. The index holds none of this tenant's records.** Both reads returned 200:

```
GET /v1/search/all?q=Rob&per_page=24   200
GET /v1/search?q=Rob&limit=8           200
```

and the Typesense collections behind them hold 4 entities, 5 orders, 5 customers
and 6 products — all of them from synthetic tenants (`tenant-aaaaaaaa`,
`tenant-ssssssss`). Halo & Hem's nine customers, twelve bookings, products and
orders are simply not in it. So the console's record search cannot find anything
this tenant owns.

## The fix, and what is left open

**Fixed: the silence.** The record half now states its own result, always, the
moment anything is typed — outside the scrolling list, because it is a statement
ABOUT the list rather than a row in it:

> Nothing in your orders, customers or products matches "Rob".

and while it is still working, "Looking through your records…", and when it finds
some, "3 records matched — the rest are screens." "Nothing matches" is an answer.
Silence is not.

**Open: the empty index.** Deliberately NOT diagnosed here, because it is an
indexing-pipeline question rather than a screen one and act 10 is about the
phone. What is established: the endpoints are reachable and answer, the
collections exist, and this tenant's rows are absent from them. Whether that is
a dev-environment gap (the indexer consumes `search.entity.changed`, and the
worker fleet does not run locally) or a real one on the platform is the next
thing to establish, and it should be established by looking rather than assumed
either way.

## Where it lives

- [components/launcher-rows.tsx](../../../apps/workbench/components/launcher-rows.tsx) — `RecordSearchNote`
- [components/launcher.tsx](../../../apps/workbench/components/launcher.tsx)

## Confirmed by

> Re-ran act 10 as Nia. Typing "Rob" still returns the three screens, and now
> says underneath them: "Nothing in your orders, customers or products matches
> 'Rob'." Which is a defect it can now be seen to have, instead of one it could
> only be assumed not to.
