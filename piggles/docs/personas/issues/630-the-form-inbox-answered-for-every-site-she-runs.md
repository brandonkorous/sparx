# 630 — The form inbox answered for every site she runs

**Status:** fixed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 212 (following [629](629-two-people-wrote-in-and-nothing-anywhere-counted-them.md))
**Surface:** mypiggles › My Site › Form replies; Home; the app rail
**Filed:** 2026-09-17
**Fixed:** 2026-09-17

## What happened

Nothing, on her screen. That is the whole reason it was still there.

`GET /v1/forms/submissions` builds a per-SITE context — `toBuilderContext` resolves
the active site from the `x-sparx-property-id` header and carries it as a
`PropertyContext` — and then hands it to three service reads that took only the
tenant:

```ts
formService.listSubmissions(ctx, q),     // ctx: ServiceContext — tenant only
formService.submissionCounts(ctx),       // ctx: ServiceContext — tenant only
formService.submissionForms(ctx),        // ctx: ServiceContext — tenant only
```

The route's own header said so out loud:

> `GET /v1/forms/submissions` → list (**tenant-wide**, newest first) + counts

So the inbox, the two numbers above it, and the form picker beside it all
answered for every site the business runs.

Measured 2026-09-17: all four of Juniper Row's replies came from her primary
site, so nothing on screen was wrong. She runs **seven**. The moment a second one
takes a message, somebody asking the clothing shop about sizing appears in the
jewelry line's inbox ([[feedback_site_is_the_business]]).

## Why it was found now

[629](629-two-people-wrote-in-and-nothing-anywhere-counted-them.md) wired
`counts.new` from this response into Home and the app rail. That turned a
tenant-wide number into a **per-site badge**, which would have put "2 people
wrote to you from your website" on a business nobody wrote to.

The first version of 629 recorded this as "not changed, but measured" — noticing
it and moving on. That is the same smell as parking a defect
([[feedback_defects_are_not_his_decision]]), and the reason given ("I cannot
confirm a fix I cannot see on her screen") was answerable: a test can build the
second site the account does not have.

## The fix

All three reads take a `PropertyContext` and filter on it. Changing the TYPE, not
just the query, is what matters: there is exactly one caller of each, it already
holds a `PropertyContext`, and TypeScript now refuses a tenant-only one.

**An orphan stays in the inbox.** `propertyId` is nullable and `SetNull`, and the
schema says why:

> SetNull so a submission outlives a deleted site (it stays in the inbox / CRM
> history).

A strict equality would have kept that promise on paper and dropped the row from
every screen there is. The filter is
`OR: [{ propertyId: ctx.propertyId }, { propertyId: null }]`, the same
empty-means-everywhere shape the rest of the platform uses. Measured: 0 orphans
today, but the promise is in the schema and the test pins it.

The route header now says **THIS SITE**.

## Guard

New `test/integration/form-inbox-site-scope.test.ts`, **5 tests**.

Three earn their place beyond the obvious:

```ts
it('counts this site, because Home and the rail read these numbers', …)
it('shows the other site its own messages, standing on the other site', …)
it('keeps a message whose site was deleted, on every site', …)
```

The counts one is the reason this is not tidiness. The second is the
both-directions rule: scoping that only ever hides is a filter that happened to
work once. The third pins the promise the strict version would have broken.

The **form picker** is covered too — it is the third read on the same response,
and a picker offering a form from another website filters the list to nothing and
explains nothing.

Proven red by removing the clause: **4 of 5** fail. The fifth is the orphan test,
which correctly passes either way, because an unscoped read also returns the
orphan.
