# 302 — She published, and two pages of her own shop disagreed about it

**Status:** fixed (by another session, in c5eca5886); recorded in act 325
**Severity:** major (for up to five minutes after every publish a tenant's site is
inconsistent with itself, page by page, and the owner has no way to know when it
has settled)
**Found by:** P03 · Juniper Row · while confirming [291] and [297] on the live site
**Surface:** the tenant site — every cached read, most visibly the header and footer
**Filed:** 2026-08-28
**Fixed:** 2026-10-06
**Confirmed by:** on screen in act 325: a journal post in 9 seconds, and her footer, published from its own pane, in 2 seconds after [921](921-she-published-her-footer-and-her-site-took-five-minutes.md)
**Blocked on:** —

## What happened

Checking that Devi's healed chrome had actually reached her shop, two pages of the
same site, loaded seconds apart, disagreed:

| Page                         | Header        | Footer's Account column                    |
| ---------------------------- | ------------- | ------------------------------------------ |
| `/products/the-everyday-tee` | **Sign in**   | —                                          |
| `/account/orders`            | **Anneliese** | Your account · Orders · **Cart**           |
| `/account/login`             | Anneliese     | Your account · Orders · **Returns** · Cart |
| `/cart`                      | **Sign in**   | **Sign in** · Orders · Cart                |

Both trees in the database were correct — draft and published each carried
`site.account-link` and `/account/returns`. Adding a cache-busting query string to
any of those addresses produced the right chrome immediately.

So a signed-in shopper could be greeted by name on one page and offered a sign-in
link on the next, in the same shop, in the same minute.

## What should have happened

Publishing is the moment a tenant says "this is my site now". After it, the site
says one thing.

## Where it lives

The storefront's builder and silica reads are cached with a 300-second TTL behind
purge tags:

    next: { revalidate: 300, tags: ['sparx-storefront', `tenant:${slug}`, `builder:${slug}`] }

They were `cache: 'no-store'` until a tag purge was built, and the comment that
justified changing them is still there in
[lib/builder.ts](../../../../wizeworks/apps/site/lib/builder.ts):

> That purge now exists — `installBuilderPubSubBridge` publishes `builder.*` to
> Pub/Sub, `cache-revalidation-worker` maps it to the `builder` scope, and
> app/api/revalidate purges `builder:<slug>`. So published reads are cached again,
> with **the TTL as a backstop rather than the mechanism**.

Every link in that sentence is real except the one that runs it:

- `installBuilderPubSubBridge` **is** installed, in `api-rest/src/index.ts`
- `planRevalidation` **does** map `builder.*` to the `builder` scope — the worker's
  own README says otherwise, and the README is the stale one
- `app/api/revalidate/route.ts` **does** call `revalidateTag(tag, 'max')`
- **`cache-revalidation-worker` is not deployed anywhere.** No manifest under
  `k8s/`, no entry in [release.yml](../../../../.github/workflows/release.yml)'s
  image matrix — which builds exactly `event-worker`, `media-worker` and
  `import-worker` — and no mention in `.github/` at all

It is a **Cloud Run push service**: `createServer`, `POST /`, an OIDC `email`
claim. That is the architecture the platform moved off — the root CLAUDE.md now
says the fleet is three Deployments and "a new handler is a package, not a
service" — and the GCP workflows its README tells you to add it to were deleted.
Its own README still says so plainly: **"Deploy wiring: NOT yet applied."**

So no tag is ever purged, and the TTL is the mechanism, not the backstop.

**Each route holds its own copy.** The frame fetch puts the request path in its
URL, so `/cart` and `/account/orders` are separate cache entries with separate
300-second clocks — which is why they disagreed rather than all being equally
stale. Per-path entries are correct in themselves: a page can carry its own frame
(`set_page_frame`), so the frame genuinely varies by path. It is the missing purge
that turns that into an inconsistency.

## Why it matters

Devi is the most technical owner in this roster and she would still have no way to
explain this. She presses Publish, looks at her site, sees the old header, presses
Publish again. The pages she happened to visit just before publishing are the ones
that stay wrong, which is exactly the set she was checking.

It is bounded and it self-heals, which is why this is major and not a blocker.

## What it would take

Out of scope for a persona run, and the reason is architectural rather than
sizing: it changes what the worker fleet is made of, and one of its decisions is
irreversible.

1. **Make it a handler package, not a service.** `@wizeworks/cache-revalidation-worker`
   exporting `createSubscription(logger)`, registered in `event-worker/src/index.ts`
   beside the other fourteen. That is the documented pattern and it adds **no pod
   and no cost** — the alternative, a fifteenth Deployment, is a spend decision.
   `src/handler.ts` (113 lines) and its unit tests carry over almost unchanged;
   `src/index.ts` (the HTTP push entrypoint) is what gets replaced.
2. **Choose the JetStream `durable` name deliberately.** Permanent once shipped —
   changing it later restarts the cursor.
3. **Subscribe it to the right topics.** `builder.*` is the one this issue is
   about; `product.*`, `content.*` and the rest are already mapped and would start
   working at the same time.
4. **Wire `SPARX_REVALIDATE_SECRET`** on both the worker and `k8s/apps/site.yaml`,
   from the secrets module. The route already checks it.
5. **Delete the Cloud Run entrypoint** rather than leaving two ways in.

The worker's README should be refreshed at the same time: its event→scope table
omits `builder.*` (the code has it), and its deploy steps point at
`build-images-gcp.yml` and `deploy-gcp.yml`, which no longer exist.

## Act 325: it was built

All five steps in "What it would take" landed in `c5eca5886`, from another
session, and this file was never told:

1. `@wizeworks/cache-revalidation-worker` is a handler package now, under
   `wizeworks/packages/`, exporting `createSubscription`, registered in
   `event-worker/src/index.ts` beside the others. No new pod.
2. Its JetStream durable is `cache-revalidation-worker`, fixed with a comment
   saying it is permanent.
3. It subscribes to `builder.published` and `builder.rolled_back` among the
   rest, and `planRevalidation` maps `builder.*` to the `builder` scope.
4. `SPARX_REVALIDATE_SECRET` is in `k8s/apps/site.yaml` and the self-hosted
   workers' secrets, and set locally on both sides.
5. The Cloud Run service directory is gone.

`lib/builder.ts` and `lib/silica.ts` now say the TTL is the backstop again.

Measured read-only in dev: the event worker is running, and the broker shows
the `cache-revalidation-worker` consumer on `SPARX_EVENTS`, created
2026-10-04, delivered and acknowledged to the same sequence, 0 pending.

Seen on screen in act 325, as a visitor and as Devi side by side. A visitor
loaded her `/blog` twice, so the list was cached. Devi changed her published
post's title from "Caring for knitwear so it lasts" to "... so it lasts for
years" and pressed Save. The visitor's page showed the new title **9 seconds**
later (still the old one at 4). She put the title back; the page followed in 8
seconds. In 056 the same kind of change took over two hours. The post's address
did not change.

That was a journal post, the `content` scope. I wrote here that the header and
footer this issue was filed on "ride the `builder` scope through the same worker
and the same route", read in the code and not driven. Driving it proved that
wrong: a footer published from its own pane took 4 minutes 29 seconds, because
the worker never subscribed to the event that publish sends. Fixed in
[921](921-she-published-her-footer-and-her-site-took-five-minutes.md); her
footer now reaches her cart and orders pages in 2 seconds, both directions.

## Fixed here

Only the false sentences, because those are what made this invisible and they cost
nothing to correct. `lib/builder.ts` and `lib/silica.ts` now say that the purge is
written but not deployed, and that the TTL is therefore the mechanism — so the next
person to read them is not told a capability exists that does not.

## Not checked

- **Whether any OTHER cached scope is affected in practice.** `commerce:<slug>`
  and `content:<slug>` hang off the same undeployed worker, so a product edit or a
  published article presumably has the same lag, but this run only drove the
  chrome. Recorded rather than assumed (CLAUDE.md RULE #4).
- **The exact staleness window in production.** Everything above was seen against
  the dev server, where the Next data cache behaves like production's but the
  numbers are not the same measurement.
