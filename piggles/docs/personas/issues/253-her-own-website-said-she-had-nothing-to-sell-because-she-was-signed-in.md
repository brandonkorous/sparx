# 253 — Her own website said she had nothing to sell, because she was signed in

**Status:** fixed
**Severity:** blocker
**Found by:** P03 · Juniper Row · act 11 — opening her published shop to leave a review on it
**Surface:** the published site › /shop (and every collection and category page)
**Filed:** 2026-08-26
**Confirmed:** 2026-08-26

## What happened

Act 11 opens on the public site. Devi's shop:

```
Shop
Everything we currently have available.

All products
0 products
🔍  No products found
Try adjusting your filters or search.
```

Seven active garments in her console. Her shop said none.

The same page, in a browser that had never signed in to anything, listed all
seven — The Everyday Tee $42.00 through the Linen Shirtdress $145.00.

**The difference is a session cookie.** Signed in: nothing to sell. Signed out:
a shop.

## What should have happened

Whether somebody is signed in changes the PRICES on a shop. It does not change
whether the shop has anything in it.

## Why it matters

This is the third door into the same room, and the worst of the three.
[203] was an empty search index rendering as an empty shop. [209] was a partly
filled one rendering as a smaller shop. Both were fixed by making the catalog
decide the set. **This one bypasses that fix entirely** — the catalog is never
asked, because the request fails before it answers, and a failed request and an
empty shop are still the same picture.

Who it reaches, worst first:

- **A returning customer whose session cannot be decoded** — a rotated signing
  secret at deploy time, a half-written cookie, a session from an instance that
  has moved on. She does not get signed out, she gets a shop with nothing in it.
- **The owner herself**, which is how it was found: Devi opened her own website
  while signed in to Piggles and read that she sells nothing. The first
  conclusion available to her is that the publish broke.
- It is silent on both sides. The console is fine, the API is fine, the products
  are fine, and the only place it shows is the page a customer lands on.

## Where it lives

[commerce.ts](../../../../wizeworks/services/api-rest/src/routes/v1/public/commerce.ts)'s
product listing resolves the viewer so a B2B customer sees their own price:

```ts
const viewerB2bAccountId = await resolveViewerB2bAccountId(request, tenantId);
```

which reaches `optionalCustomer` → `getCustomerSession` →
`auth.api.getSession({ headers })`. Better Auth is handed the raw Cookie header
and asked to resolve it. A cookie it cannot decode is not a null — it is a
throw, and nothing on the path catches it, so the endpoint 500s.

The storefront then does exactly what it was designed to do with a failed
request, which is the cruel part. `catalogFallback` returns null on any error —
deliberately, because "could not answer" must never be printed as "nothing to
sell" — and `askIndex` returns null too. Both null, so:

```ts
return indexed ?? EMPTY_LISTING(filters);
```

`EMPTY_LISTING` renders as **0 products · No products found**. The one branch
written to avoid claiming an empty shop is the branch that claims it, because
there is nowhere else for two nulls to go.

`getCustomerSession` already returns null for every OTHER way a session can fail
to resolve — no cookie, no user on it, a session belonging to another tenant.
An undecodable cookie is the same answer: **this viewer is not signed in.** It
is the one case that throws instead.

## The fix

Two layers, because the failure had two halves.

**The cause.** `getCustomerSession` treats an undecodable credential the way it
already treats every other unresolvable one: as anonymous. The function's whole
contract is "the session cookie's user, or null", and it is the single point of
change — every caller of `optionalCustomer` is fixed by it at once. The catch is
around the credential decode ONLY; a failure to write the membership row still
propagates, so `requireCustomer` cannot start answering "Session expired" to a
customer whose session is fine.

**The consequence.** On a product listing, resolving the viewer's price is an
ENHANCEMENT. It must not be able to remove the products, whatever goes wrong
inside it — so `resolveViewerB2bAccountId` degrades to "no B2B viewer" rather
than failing the read. A shopper in that state sees list prices instead of
contract prices, which is a smaller wrong answer than an empty shop by a
distance, and it is the same principle [203] settled: never let a failure to
answer a question print as an answer of zero.

## Confirmed

Re-run as Devi on 2026-08-26, in the same browser profile, signed in to the
console at `localhost:3022` as she was when she found it.

`localhost:3004/shop` — the exact URL that read **0 products · No products
found** — now lists **7 products**: The Everyday Tee $42.00, Linen Shirtdress
$145.00, The Ash Overshirt $128.00, Marlow Knit $96.00, Silk twill scarf $58.00,
Leather-covered belt $72.00, Sunday Trouser wide leg. Her shop is her shop again
whether or not she is signed in to anything.

Against the running API, the listing answers 200 with all seven both with no
cookie at all and with a session cookie that cannot be decoded. The difference
the defect turned on is gone.

### The exit did not recur, and a malformed cookie cannot cause one

The third owed check, because "if a malformed cookie CAN take the API down, that
is a bigger issue than this one." It cannot. Five shapes of undecodable
credential — empty, bare dots, invalid percent-escapes, a two-part token, an
alg-none JWT — each answered 200, and `/health` answered 200 before and after.
The process that exited during the trace stayed exited for reasons of its own;
nothing here reproduces it, so it is recorded as unexplained and closed with the
issue rather than carried as a finding.

## Related

[203] and [209] are the same picture from the other two directions, and their
fixes are what makes this one render as a plausible empty shop rather than as an
error.

## Rating effect

The published shop, in [rating.md](../rating.md). Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
