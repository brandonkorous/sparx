# 790 — "What this site shows" switched nothing off

**Status:** fixed
**Severity:** high
**Found by:** P03 · Juniper Row · act 278
**Surface:** the tenant site + api-rest + `platform.settings.site`, `commerce.product.channels`
**Filed:** 2026-09-23
**Blocked on:** —

## What happened

A site's own settings screen carries a card with eight switches:

```
What this site shows
Switch off anything this site has no use for. It stays available on your other sites.

  [x] Selling      [x] Content    [x] Customers   [x] Email
  [x] Wholesale    [x] Dropship   [x] Inventory   [x] AI
```

Devi runs seven sites off one account. Her jewelry is listed on **Juniper Row
Journal**, which is where she writes, so she switched **Selling** off on it. The
screen said "Saved just now."

Then the journal kept its shop. All of it.

```
header     Shop  Journal              About  Contact
/cart      200, with a $158.10 item in it and Proceed to checkout
/shop      200, the product grid
/products  200
footer     Explore: Shop · Search      Account: Orders · Returns · Cart
sitemap    every product URL
```

Nothing happened, and the screen had told her something had.
[[feedback_a_promise_in_copy_is_a_contract]]

## Why nothing happened

`moduleScope` was written by that screen, stored on the property, and projected
into the public tenant payload on **every page load**. It was read by exactly one
thing on the platform: the site's MCP tool catalog.

The payload's own comment said otherwise:

> Per-site disabled modules (docs/49 Slice F). Empty = all tenant-active modules
> are on. **The storefront uses this to gate module-specific routes** (e.g. a
> wholesale site with commerce disabled shows a static catalogue).

It did not. `ResolvedSite` — the storefront's own type for the payload — never
declared the field, so it was dropped at that boundary and nothing downstream
could have used it. Searched across the whole repo, `disabledModules` appeared in
seven files and not one of them was a site app.
[[feedback_screen_over_a_function_nobody_calls]]

Two other notes pointed at the same hole from different sides. The console's
`Site` type said "see `useSiteModules`", a function that has never existed in
either console. And `docs/89-feature-catalog.md` already knew:

> 🗺️ **Per-site module scope** — disable a module on one site (field exists;
> enforcement deferred).

Deferred, with eight live switches and a sentence promising what they do.

## What was done

The switches work now, front to back.

**One table, so a new route cannot be gated in one place and open in another.**
`apps/site/lib/site-modules.ts` states which module owns which path once, and the
route gate, the chrome link filter, the account nav and the sitemap all read it.
Longest prefix wins and only at a segment boundary, so `/account/b2b` is
Wholesale rather than Selling and `/cart` never takes `/cartography` with it.

**The module a thing belongs to is already written into its key.** A host core is
`commerce.plp` or `cms.article-body`; a collection page's record type is
`commerce.product`. So a page a tenant called "Shop" can be refused for what is
_inside_ it, with no list of slugs to keep in step. `commerce.auth` is the one
exception: a visitor still signs in on a site that sells nothing.

| what                   | how                                                                         |
| ---------------------- | --------------------------------------------------------------------------- |
| 12 code routes         | `requireSiteModule(site, 'commerce' \| 'cms' \| 'crm')`                     |
| the tenant's own pages | refused by the cores they carry and their record type                       |
| the header and footer  | links to refused pages pruned out of the frame                              |
| the account nav        | `offers` now answers per site, not per account                              |
| 7 account sub-areas    | a server layout above the client pages, because a hidden link is not a gate |
| the starter chrome     | `commerceEnabled` / `cmsEnabled` are the SITE's answer now                  |
| the sitemap            | same flags, so a crawler is never sent to a refused URL                     |
| `llms.txt`             | no catalog advertised, and the MCP line stops offering to shop              |

**Absent is never off.** Every read of this field falls back to an empty list. A
lookup that blips must not take part of a live site down with it.
[[feedback_never_present_absence_as_measurement]]

## The bug inside the fix

The chrome prune returned the ORIGINAL node whenever no DIRECT child had been
dropped — throwing away every rebuilt descendant with it. A real header is four
levels deep, so nothing at all was pruned, while nine unit tests, every one of
them one level deep, stayed green. Found by looking at the page, not by running
the tests. [[feedback_a_test_that_cannot_go_red]]

There is now a test that drops a link four levels down, and it goes red against
the old walk.

## Proof

Driven as Devi, with Selling switched off on the Journal and then back on:

```
              off      on
/cart         404      200
/shop         404      200
/products     404      200
/journal      200      200     Content is a different switch
/about        200      200
/blog/…       200      200

header        Journal · About · Contact          Shop · Journal · About · Contact
footer        Journal · About · Contact          + Shop · Search
account       Your account                       + Orders · Returns · Cart
```

No empty bullets left behind, and the home page is never refused.

The console's **Where it is listed** pane, which is what sent me looking, stopped
saying "On sale" about a site that sells nothing:

```
Juniper Row Journal                              [Selling is off here]
This site has Selling switched off, so nothing is bought here.
Open this site's settings →
```

## What is NOT fixed, and is not new

The site catches up within its cache window rather than at once — up to five
minutes. That is the storefront's 300-second data cache and it is the same for
every site setting: the site name, the brand, the social links. It is already on
file as [issue 056](056-she-published-and-her-site-showed-the-old-page-for-eight-minutes.md).
Closing it means a `property.updated` event, a topic, and one line in
`cache-revalidation-worker`'s scope map — a piece of work of its own, in the
event catalog rather than here. The server-side read added in this change is
deliberately NOT cached, so nothing new was added to the delay.

Three of the eight switches reach nothing on a site because there is nothing of
theirs on one: Dropshipping, Inventory and Email own no page and no link a
visitor can see. They are stated as owning nothing rather than left ambiguous.

## Files

- `wizeworks/apps/site/lib/site-modules.ts` (new) + `site-modules.test.ts` (new, 36)
- `wizeworks/apps/site/lib/site-context.ts`, `silica.ts`, `customer-client.ts`
- `wizeworks/apps/site/components/customer-provider.tsx`
- `wizeworks/apps/site/app/layout.tsx`, `llms.txt/route.ts`, `[...slug]/page.tsx`
- 12 gated route files under `wizeworks/apps/site/app/`
- 7 new server layouts under `wizeworks/apps/site/app/account/(authed)/`
- `wizeworks/services/api-rest/src/lib/site-hidden-paths.ts` (new)
- `wizeworks/services/api-rest/src/lib/property.ts`, `builder-context.ts`
- `wizeworks/services/api-rest/src/routes/v1/public/builder.ts`, `public/account.ts`, `sitemap.ts`
- `wizeworks/services/api-rest/test/integration/account-offers.test.ts` (+4)
- `wizeworks/packages/builder-schemas/src/site-sync.ts`
- `piggles|sparx/apps/workbench/surfaces/commerce/product-channels.tsx`
- `piggles|sparx/apps/workbench/surfaces/sites/data.ts`
- `docs/89-feature-catalog.md`
