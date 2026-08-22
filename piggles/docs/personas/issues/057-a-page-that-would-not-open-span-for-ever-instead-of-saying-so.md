# 057 — A page that would not open spun for ever instead of saying so

**Status:** fixed
**Severity:** major (unrecoverable pane; also the cross-tenant probe's answer)
**Found by:** P01 · Thistle & Rye · act 11 — a mis-click while adding a page
**Surface:** mypiggles › the page editor
**Filed:** 2026-08-21 · **Fixed:** 2026-08-21
**Confirmed by:** P01 · act 11 — same URL, cold load, now says what happened

## What happened

A stray click sent the studio to a page id that is not hers. The pane said:

> 🐷 **Opening your page…**

and went on saying it. Minutes, a full reload, then minutes again. No error, no
timeout, no retry button. The only way out is to close the pane.

## Two findings, and the first one is good news

**Tenant isolation held.** The id `ffafc3d1-…` is the **Home page of a different
tenant**. `GET /v1/builder/pages/ffafc3d1-…/silica` returned **404** — not the
page, and not a 403 either, so the console cannot even confirm that the id
exists. That is the right answer and it is the answer this run's standing
cross-tenant probe was looking for.

**The console could not say so.** The page editor already HAS the right screen for
this — _"This page isn't here any more. It may have been deleted."_ with a **Pick
another page** button, and its `missing` state is even documented as covering "or
from another site". It was unreachable.

## Why it happened

`usePage` took the shared `retry: 2` default. A 404 is not a transient fault: it
will be a 404 the second and third time too. While those retries are outstanding
the query's status stays `pending`, and the pane renders `pending` as _"Opening
your page…"_ — so the one state that could explain itself never got its turn, and
the backoff meant it effectively never did.

The console already knows this rule and states it elsewhere, in
`useStockItem`:

> _"A 404 means the variant is gone, which is an answer rather than a fault —
> retrying it three times just delays saying so."_

`usePage` is the one query in the studio that takes an arbitrary id straight off
the URL, so it is the one where a bad id is reachable at all. The layout, symbol
and piece reads are singletons keyed by site and cannot be pointed at a stranger.

## The fix

```ts
retry: (attempt, error) =>
  error instanceof ApiError && error.status === 404 ? false : attempt < 2,
```

Everything else still retries — a dropped connection is a fault and worth asking
again. Only the answer that will not change is taken at its word.

## Confirmed

Same URL, cold load, another tenant's page id:

> This page isn't here any more. It may have been deleted.
> **[ Pick another page ]**

## Noticed on the way

Every load of the studio fetches **all seven** of her pages' bodies, not just the
one being opened. Two ids in that set 404 on every load — one is the stranger's
page from the URL, the other (`6c1b75b5-…`) is requested with no prompting from
me and belongs to nothing. Something is holding a reference to a page that no
longer exists and asking for it on every boot, quietly, twice per load counting
the CORS preflight. Nothing breaks; it is just work nobody asked for and a
reference nobody cleans up.
