# 035 — Publishing her site said "undefined pages are live"

**Status:** fixed
**Severity:** major (the success message for the most consequential action in the app)
**Found by:** P01 · Thistle & Rye · act 7 step 6 — publishing. Brandon reported the
same shape independently ("undefined posts published") mid-session.
**Surface:** mypiggles › My Site › Publish
**Filed:** 2026-08-20
**Fixed:** 2026-08-20
**Confirmed by:** — (owed: the next publish)

## What happened

Marisol pressed **Publish everything**. It worked — seven pages went live. The
toast said:

> **undefined pages are live**

## Why it matters

This is the moment a business owner puts their website in front of the world, and
the only feedback is a word that means "something is broken". Nothing WAS broken,
which is worse: the natural reaction is to publish again, or to go looking for
what failed.

## The root cause

The route returns:

```ts
return ok({ published: true, releaseId: release.id, hash: release.hash });
```

The console declared:

```ts
export interface PublishResult {
  pages: number;
  publishedAt: string;
  release: { id: string; hash: string };
}
```

**Three fields, none of which has ever been on the wire.** `api.post<T>()` is an
unchecked cast, so TypeScript agreed with the declaration and never compared it to
the handler. `String(result.pages)` → `"undefined"`.

And the count was not missing — it was computed and thrown away.
`siteService.publish` counted `publishedPageCount` for the audit log and the
Pub/Sub payload, then returned `{ id, hash }`.

## The fix, in three places

1. **`siteService.publish`** returns `{ id, hash, pages }` — the number it already
   had.
2. **The route** sends `pages` alongside the release, because it is the part a
   PERSON reads.
3. **`PublishResult`** now declares only fields the route actually sends, with a
   note that this is what an unchecked cast costs.

And the toast no longer trusts it blindly: a count that is not a number produces
_"Your website is live"_ rather than a rendered `undefined`. A toast is the wrong
place to discover a contract drifted.

## The wider shape

Every other count-bearing toast was checked against its handler:
`staff/shifts/publish` really does return `{ published }`; the reviews/QA bulk
actions really do return `{ count }`. This was the only mismatch. But the reason
it survived is general — `api.post<T>` will believe anything — so a client type
here is a claim, not a check.

**Not found:** a literal "posts published" toast anywhere in the tree, so if that
exact wording came from a surface I have not walked, it is a second instance and
I would want to know where it was seen.

## Confirmed by

Nothing yet — the fix landed after the publish that exposed it, and the pane
correctly reports nothing left to publish. **Owed:** watch the toast on the next
publish.

## Rating effect

None recorded yet.
