# 763 — The Quotes list hid fourteen of the fifteen quotes on the machine

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 270
**Surface:** platform — `GET /v1/b2b/quotes`, read by both consoles
**Filed:** 2026-09-21
**Fixed:** 2026-09-21
**Confirmed by:** P03, on screen, two minutes after saving one
**Blocked on:** —

## What happened

She priced up her first quote, **Q-000016**, $1,008.00 to Tamsin Vale of Loom
and Larder. Saved. Went back to Quotes:

```
                         No quotes yet

     A quote is a price you send a business before they buy…
```

The quote was in the database. The tab for it was still open two along.

## MEASURED, before the fix

```
 has_company | count
 f           |    14
 t           |     1
```

Fifteen quotes on this machine across every tenant, and **fourteen of them
would never appear in anybody's Quotes list**. Juniper Row's own:

```
  number  | company_id
 Q-000016 |
```

## Why: a filter that read like a definition

```ts
...(q.account_id ? { companyId: q.account_id } : { companyId: { not: null } }),
```

Read as English that is "a trade quote belongs to a trade account". Behaves as
"hide any quote that does not have one." The workflow slug already scopes the
query to quotes; the extra clause only ever removed rows.

And nothing in the console could satisfy it. The invoicing editor's picker
chooses a CUSTOMER; it has no "which business" field, so `companyId` stayed
null on every quote the console produced. The one quote that had an account came
through the customer portal, whose route passes `companyId: accountId` because
the URL contains the account.

Two doors to the same list, one of which the list silently refused.
[[feedback_absent_behaves_like_fine]]

The tell was on the dashboard the whole time: the B2B summary counts open
quotes with **no** company clause, so the same data answered "3 open quotes" in
one place and "No quotes yet" in the other. One question, two answers.

## What was done

**The workflow is what makes a document a quote, and it is the only thing that
does.** The `companyId: { not: null }` clause is gone. A quote with no account
attached still belongs to whoever asked for it, and she still has to see it.

**The account comes along by itself.** `billingDocumentService.create` now
reads the chosen customer's own `companyId` — the wholesale account that person
buys for, which is the fact the pricing engine already reads (issue 744) — and
attaches the document to it when the caller named only a person. A caller that
named an account wins; never the other way round, because a document
deliberately addressed to one account must not be moved to another because of
who happened to ask. `update` does the same when a document is moved onto a
person who buys for an account and had none.

This is the fix at the single point: the Quotes list, the wholesale invoice
list and the customer's own portal all ask "which business is this for", and
now every door answers.

## Files

- `wizeworks/services/api-rest/src/routes/v1/b2b/quotes.ts` — the filter, and the lines
- `wizeworks/packages/crm/src/services/billing-document-service.ts` — `assertPartyExists` reports the account to inherit

## Proof

Read on screen 2026-09-21, after the fix:

```
Quote       Business          Valid until    Total       Standing
Q-000017    Loom and Larder   —              $504.00     Draft
Q-000016    Tamsin Vale       Oct 31, 2026   $1,008.00   Draft
```

**Q-000017** was saved after the service fix and picked up Loom and Larder with
nothing typed:

```
  number  |              company_id              |  company_name
 Q-000017 | 9b6d9f03-578b-4388-8ff7-d3ad08f3840d | Loom and Larder
```

**Q-000016** was saved before it and has no account, which is the fix's own
before-and-after sitting in two rows of one table — and the point of removing
the filter, because that row is hers and she can see it either way.

## Also fixed on the way

The quote detail pane showed a total with nothing under it. A quote IS its list
of lines, so the one screen for checking what a business asked for could not
answer that question and she had to open the pricing editor to read her own
quote back. The route's projection now carries the lines and both consoles draw
them. The Piggles pane was also missing its identity heading, which the sparx
one had — the number lived in the tab title and nowhere on the page, and the
number is the thing a shop reads back down the phone.
