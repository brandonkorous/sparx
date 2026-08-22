# 021 — The home page told her nobody could reach it

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Thistle & Rye · act 7 — reading the page list after the delete
**Surface:** mypiggles › My Site › Page — the page list
**Filed:** 2026-08-20
**Fixed:** 2026-08-20
**Confirmed by:** P01 · act 7, on the screen

## What happened

Five pages in the list. The first row read:

| Page | Address            | Kind      | Status       |
| ---- | ------------------ | --------- | ------------ |
| Home | **No address yet** | Home page | Not live yet |

Two columns of the same row contradicting each other. "Home page" is right — it
is the site's front door. "No address yet" is what the other four pages would say
if she had never given them one, and it means _nobody can get to this_.

## What should have happened

The home page's address is the site itself. It reads **Your front page** now,
which is the same fact the Kind column states, said in the column that was
denying it.

## How to reproduce

Every time, on any site:

1. **My Site → Page**.
2. Read the Home row.

## Why it matters

Small, and worth fixing at once, because of _which_ page it lies about. The home
page is the one every visitor lands on and the one an owner worries about most,
and the list told her it had no way in — on the same screen where the site check
was already complaining about addresses. A person acting on that would go into
page settings and give the home page a slug, which is exactly the wrong move: it
would stop being the front page.

The cause is the same one behind [017](017-the-deleted-home-page-came-back-21-milliseconds-later.md):
"slugless" was being read as "unset" instead of as "the root". `routeOf` already
knew the rule; `addressOf` restated it and got it wrong.

## Where it lives

`piggles/apps/workbench/surfaces/studio/page-address.ts` — `addressOf`, which now
defers to `routeOf` rather than reading `page.slug` itself.

## The fix

```ts
export function addressOf(page: PageSummary): string {
  if (page.kind === 'collection') return 'One page per record';
  const route = routeOf(page);
  return route === '/' ? 'Your front page' : route;
}
```
