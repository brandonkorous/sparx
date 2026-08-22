# 017 — The deleted page came back 21 milliseconds later, with a new id

**Status:** fixed
**Severity:** critical
**Found by:** P01 · Thistle & Rye · act 7
**Surface:** mypiggles › My Site › Page — and every site whose home page came from a look rather than the starter
**Filed:** 2026-08-20
**Fixed:** 2026-08-20
**Confirmed by:** deleted the same page again as Marisol — it stayed deleted; the audit log shows a `builder.page.deleted` with nothing after it, where before it was followed by a `builder.pages.home_ensured` 21 ms later
**Blocked on:** —

## What happened

With [016](016-the-check-told-her-to-delete-a-page-and-nothing-could.md) fixed,
Marisol deletes the empty **Home — Landing** the site check told her to. The confirm
is right, the toast says **"Home — Landing" deleted**, and the row is still there.

Not a stale list. The page was genuinely deleted and genuinely re-created, and the
audit log has both, three hundredths of a second apart:

```
01:47:10.075  builder.page.deleted     6c1b75b5…  {"before": {"name": "Home — Landing"}}
01:47:10.096  builder.pages.home_ensured  e66ce60e…  {"after":  {"name": "Home — Landing"}}
```

A different id. It is not the same row restored — it is a **new page with the same
name**, created by the server on the very next read of the page list.

## What should have happened

Deleting a page deletes it.

## The cause, which is older and bigger than the delete

`listOrSeed` heals a home-less site. A site with no `/` has no front door, so if the
page list is read and nothing looks like a home page, it injects the starter landing
page. That is a good rule and it is doing its job.

It just cannot recognise a home page.

**"No address" is stored three ways.** A sparx-seeded home writes `NULL`. A
blueprint-installed home writes `''`. An imported one can carry `'/'`. Every other
reader in the platform knows this:

| Reader                                                     | Recognises          |
| ---------------------------------------------------------- | ------------------- |
| `siteService.getPublishedHome` — what the live site serves | `NULL`, `''`, `'/'` |
| `site-lint`'s `addressOf` — what the check counts          | `NULL`, `''`, `'/'` |
| `blueprints/capture` — "all three are the home page"       | `NULL`, `''`, `'/'` |
| **`pageService`** — what decides whether to inject one     | **`NULL` only**     |

Marisol picked the **Café** look. Its home page stores `''`. So an hour after she
finished onboarding, the first read of her page list found a site with five pages and
— as far as this one test was concerned — no home. It injected a second one.

The audit log dates it exactly:

```
2026-08-19 23:30:01   the Café blueprint installs Home, Menu, Book, About, Contact
2026-08-20 00:25:42   builder.pages.home_ensured → "Home — Landing"
```

**Fifty-five minutes after the install, on a page read, from nothing she did.**

## What this corrects

[015](015-the-cafe-template-left-her-with-two-home-pages-and-somebody-elses-name.md)
named two suspects for the duplicate home page — the blueprint installer not
reconciling with the starter, and the starter's own seed. **Both were wrong.** The
starter never created that page; `home_ensured` did, long after the install. The
installer's only fault is writing `''` where this file expected `NULL`, which is not a
fault at all — `''` is one of the three legal spellings and the live site reads it
correctly.

So the fix belongs here rather than in the installer, and it closes the duplicate-home
half of #015 for every tenant, not just for Marisol.

## How to reproduce

Before the fix, every time, any trade:

1. Sign up, and in onboarding pick any look that is **not** the Universal Starter.
2. Open **My Site → Page**. Six pages, two with no address.
3. `select action, entity_id, created_at from audit_logs where action like 'builder.pages%'`
   — a `home_ensured` timestamped at the first page-list read, not at the install.
4. Delete the injected one. It returns on the next read with a fresh id.

## Why it matters

Three separate ways, each worse than the last:

1. **Every non-starter look ships a broken site.** Two pages claim `/`, one of them
   blank, and the pre-publish check calls it an error the owner did not cause.
2. **A delete that reports success and undoes itself** teaches somebody that the
   console cannot be trusted — and it is silent, so the only way to notice is to count
   the rows twice.
3. **It is indistinguishable from a correct outcome.** The list looks fine. Nothing
   errors. This is precisely the failure `site-lint` exists to catch, and it was in
   the code that decides what a site's pages are.

It also puts a floor under the delete in #016: without this, the one page the check
most often tells people to remove is the one page that cannot be removed.

## Where it lives

`wizeworks/packages/builder/src/services/page-service.ts` — four reads, all narrow:

```ts
where: { kind: 'singleton', slug: null, propertyId: ctx.propertyId }
```

in `ensureHomeTx` (the injector's own "do we already have one?" probe), in
`listOrSeed`'s `hasHome`, and in the legacy `getPublishedHome` / `getDraftHome`.

## The fix

One rule, named once, used by all four — the same rule `siteService` already had a
comment for:

```ts
const HOME_SLUGS = ['', '/'] as const;

export const homeWhere = (propertyId: string) => ({
  kind: 'singleton',
  propertyId,
  OR: [{ slug: null }, { slug: { in: [...HOME_SLUGS] } }],
});

export function isHomeRow(row: { kind: string; slug: string | null }): boolean {
  return row.kind === 'singleton' && HOME_SLUGS.includes(row.slug ?? '');
}
```

Strictly a narrowing of when a home gets injected: it now declines to inject one
where a home already exists under a different spelling. Nothing that used to get a
home stops getting one.

`page-home.test.ts` locks it — six cases, including that a `collection` with a null
slug is **not** a home (ten product templates are not ten home pages) and that
`homeWhere` still asks for all three spellings. The test asserts the query's shape
rather than hitting a database, because the failure it guards against is an edit
narrowing it back to `slug: null`.

## Confirmed by

> Deleted **Home — Landing** again as Marisol, from the same list, with the same
> confirm. Toast, row gone, **five** pages — and it stayed five through a pane
> reload and a fresh page-list read.
>
> ```
> Home     (empty)   ← the Café blueprint's home, recognised at last
> Menu     menu
> Book     book
> About    about
> Contact  contact
> ```
>
> The audit log now ends at `01:49:59 builder.page.deleted`. Nothing follows it.

## Rating effect

No pane's score changes — the surface always looked right. That is the point of it.
