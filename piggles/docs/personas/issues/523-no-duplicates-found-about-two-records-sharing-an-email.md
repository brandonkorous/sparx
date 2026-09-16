# 523 — "Nobody shares an email address", about two records that share an email address

**Status:** fixed and proven
**Severity:** minor
**Found by:** Devi, checking a screen that said everything was fine
**Surface:** `piggles/apps/workbench/surfaces/crm/duplicates.tsx`
**Filed:** 2026-09-15

## What she saw

**Possible duplicates**, on her main site:

> **No duplicates found**
> Every customer looks unique. **Nobody shares an email address**, or a name and
> company. We check whenever you reopen this, so come back after a busy spell.

A calm, well-written empty state. It is not true.

```
f9599d5a…  Marguerite Adeyemi  marguerite.adeyemi@example.com  site: primary   created Aug 26
79f10115…  (no name)           marguerite.adeyemi@example.com  site: archive   created Aug 29
```

Two customer records, one email address, one business.

## Why — and why the search is right

`findLikelyDuplicates` keys every bucket by the site:

```ts
// The site prefix is what keeps two businesses' customers apart; `~` marks
// the tenant-wide book, which is its own bucket rather than a wildcard
// that would chain every site's copy of one person into a single group.
const book = c.propertyId ?? '~';
```

That is **correct and deliberate**, and it is the platform's own rule: a tenant
is a billing container and a site is the business a customer deals with. Two
unrelated businesses under one owner must never have their customer books
chained together by a shared address.

The consequence is that the same person arriving through two of _her_ sites is
two records, and no site can see them as a pair — the query on `primary` fetches
`propertyId = primary OR propertyId IS NULL`, so the `archive` row is never even
read. With no active site the code scans every book, and the bucket key still
separates them. **There is no state in which that pair is visible.**

Which is a design, not a bug. The bug is that the screen **denied** it instead of
explaining it.

## The distinction that matters

"No duplicates found" is true. "Nobody shares an email address" is a claim about
the whole business, made after looking at one site. A sentence that states a fact
is testable, and this one fails — which is the same shape as every other promise
in this journal that turned out not to be kept.

Worse, it is the one sentence that would have told her what to do. A business
with seven sites needs to know that a person who bought from two of them is two
records on purpose; otherwise the screen simply looks broken the day she notices.

## What changed

The empty state now says what was actually checked, and names the book:

> **No duplicates found**
> Nobody in **Juniper Row's** customers shares an email address, or a name and
> company. Each of your sites keeps its own customers, so somebody who bought
> from two of them is two records here on purpose. We check again whenever you
> reopen this.

A business with **one** site gets the original sentence, unchanged — being told
its customers are kept per site helps nobody when there is one. Both the site
list and the active site are already in the shell's cache (the rail reads them),
so naming the site costs no request.

## Proven

On her live screen, standing on `primary`:

```
Nobody in Juniper Row's customers shares an email address, or a name and
company. Each of your sites keeps its own customers, so somebody who bought
from two of them is two records here on purpose. We check again whenever you
reopen this.
```

## Checked and not a defect

Two "Priya Anand" records, both with no company and only one with an email. The
name rule requires a company (`c.lastName && c.companyName`) and the email rule
needs two emails, so neither fires. That matches what the screen says it checks,
and the screen is right to leave them alone.
