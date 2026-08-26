# 253 — Her own website said she had nothing to sell, because she was signed in

**Status:** open
**Severity:** blocker
**Found by:** P03 · Juniper Row · act 11 — opening her published shop to leave a review on it
**Surface:** the published site › /shop (and every collection and category page)
**Filed:** 2026-08-26
**Blocked on:** confirmation — api-rest is down and only Brandon restarts it

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

Traced, not yet confirmed on a running server (see Status).

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

## The fix (written and unit-proved; not yet driven through the screen)

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

## Not proved yet, and why

api-rest exited while this was being traced and nothing was listening on 3100
afterwards. The console, the site and the marketing app all stayed up.

**My first thought was that the requests I had just sent caused it, and that
looks wrong.** Its own typecheck is red in three packages, none of them touched
here:

```
packages/crm/src/services/lead-clock.ts      leadResponseDueAt does not exist on Customer
packages/builder/src/services/form-submit-service.ts   partialStep does not exist
packages/sms/src/delivery.ts                 Cannot find module '@wizeworks/db'
```

All three belong to work in progress in the same tree: four uncommitted
migrations (`20270423`–`20270426`), a new `93-sms.prisma`, and the two service
files that read the columns they add. The Prisma client has not been regenerated
against them — correctly, since regenerating rewrites the client the running
stack imports and is nobody's to run mid-session. A service importing a module
that does not resolve, or reading a Prisma field that is not on the generated
client, is a far likelier way for the process to end than a 500 inside a request
handler, which Fastify turns into a response rather than an exit.

So the exit is recorded as **unexplained and probably unrelated**, not as a
finding. What is NOT in doubt is the defect above: seven products signed out,
zero signed in, on two different tenants, read off the screen twice.

The confirmation beat of RULE #3 is owed, and needs the server back:

1. reproduce the failed listing with a foreign cookie against a running api-rest,
2. re-open `/shop` signed in and read seven products,
3. and confirm the exit does not recur — if a malformed cookie CAN take the API
   down, that is a bigger issue than this one and gets its own number.

## Related

[203] and [209] are the same picture from the other two directions, and their
fixes are what makes this one render as a plausible empty shop rather than as an
error.

## Rating effect

The published shop, in [rating.md](../rating.md). Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
