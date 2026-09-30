# 845 — She pays, and her website stays dark

**Status:** fixed
**Severity:** the one minute a business owner is least able to wait
**Found by:** P03 · Juniper Row · act 291
**Surface:** The tenant site renderer, after a payment
**Filed:** 2026-09-25
**Fixed:** 2026-09-25
**Confirmed by:** four real sites, watched going from dark to live

## How it was found

Four businesses' sites were dark because their trials had lapsed (issue 844).
Their platform subscriptions were set to `active` in the database — one
statement, four rows.

Straight away, every one of those sites answered `robots.txt` with **200**: the
billing phase had flipped and the renderer knew it.

Every one of them went on serving this, to a person, for another five minutes:

> ### Back soon
>
> This site is taking a short break.

## Why

The storefront resolves its tenant once per request, and that payload carries
`billingPhase` — the single field the whole site goes dark on.

```ts
// wizeworks/apps/site/lib/site-context.ts
const res = await fetch(`${BASE_URL}/v1/public/tenants/${slug}`, {
  next: {
    revalidate: 300,
    tags: [`tenant:${slug}`],
  },
});
```

**Five minutes**, and nothing purged the tag when the phase changed.

`lib/suspended.ts` argued this exact point and won it, one layer too low:

> Nothing is cacheable, because suspension lifts the moment a payment goes
> through and a cached "stay out" would keep the shop dark to a crawler after
> the business has already paid to be visible.

Every dark **answer** was made `no-store` on the strength of that sentence. The
thing that **decides** the answer stayed on a five-minute cache.
[[feedback_a_fix_leaves_its_neighbour_behind]]

## What that is like

Her site has gone dark. She finds out because a customer tells her. She opens
the console, adds a card, and the console says she is back.

She opens her own website. It says **Back soon**.

Nothing on any screen says to wait, because nothing knows to. So she adds the
card again.

## The fix

The tag was already there. The purge endpoint was already there. The worker that
calls it had no case for billing.

```ts
// wizeworks/services/cache-revalidation-worker/src/handler.ts
if (type === 'tenant.subscription.changed') {
  return 'site';
}
```

`tenant.subscription.changed` is published by the Stripe billing webhook after
reconciliation, so it carries the post-Stripe truth — and it was already being
consumed by the platform CRM worker, so this is a real event with a real
publisher rather than a plausible name.

The scope is `'site'` because the tag that matters is `tenant:<slug>`, which the
storefront's revalidate route purges on **every** call whatever scope it is
given. There is no scope of its own to add: this is the tenant payload, not a
section of it.

**Cost: nothing.** No extra fetch per request, no shorter cache, no new
infrastructure. One event that was already flying, mapped to a purge that
already existed.

## Proved red before it was believed

```
 × purges a tenant whose platform subscription moved
 Tests  1 failed | 8 passed (9)
```

One test, exactly. The second new test — `leaves commerce subscriptions alone` —
passes on the OLD code deliberately: `subscription.created`, `.renewed`,
`.paused` are a **shop's own customers'** commerce subscriptions, a different
thing with a confusingly similar name, and the fix must not purge on those.
Green after: 9 of 9. [[feedback_a_test_that_cannot_go_red]]

## Watched, not assumed

|                                         | robots.txt     | the page      |
| --------------------------------------- | -------------- | ------------- |
| the moment the subscription went active | **200** (live) | **Back soon** |
| five minutes later                      | 200            | **live**      |

```
quiet-haven-3783     live — Thistle & Rye — bakery on Mercer Lane
halo-and-hem         live — Halo & Hem — a two-chair hair salon in midtown
wildroot-flowers     live — Wildroot Flowers2
marrow-review        live — The Marrow Review
```

The gap between those two rows is the defect, and it is the reason this was
visible at all: the two halves of one answer disagreed for exactly as long as
the cache held.

## Noticed in passing

Wildroot Flowers' site is titled **"Wildroot Flowers2"**. The tenant is named
correctly and the site is not; it is that business's own data rather than
anything the product did, so it is left alone and recorded here.

## Files

- `wizeworks/services/cache-revalidation-worker/src/handler.ts`
- `wizeworks/services/cache-revalidation-worker/test/handler.test.ts`

## The thing to remember

**A cache is a promise that nothing important changed.** This one was set to
five minutes for a payload that is mostly a name, a logo and a set of colors —
all of which can wait five minutes — and it also carried the one field that
decides whether the business has a website at all.
