# 296 — The repair that heals a stale header had never been run

**Status:** fixed
**Severity:** major (three chrome repairs written, documented and tested, wired to
nothing — so every already-published tenant keeps the broken header the repairs
exist to fix)
**Found by:** P03 · Juniper Row · while fixing [291]
**Surface:** the console — **My Site** (the studio), on load
**Filed:** 2026-08-27
**Fixed:** 2026-08-27
**Confirmed by:** Devi's stored frame healed and persisted on studio load, verified in the database

## What happened

While fixing [291] I needed to know whether the fix would actually reach Devi. It
would not, and the reason turned out to be bigger than [291].

Her site's chrome is a **stored tree**. Both of her frame trees carry the stamped
sign-in link:

```
 silica_published_tree LIKE '%account/login%'  →  t
 silica_draft_tree     LIKE '%account/login%'  →  t
```

Improving the composite that generates the chrome never reaches a tenant who has
already got one. The codebase knows this — there is a whole module for it,
`upgrade-frame.ts`, opening with:

> THE PROBLEM THIS EXISTS FOR. A frame is a stamped node tree: copied at insert,
> frozen at publish. Improving the composite that produced it never reaches a
> tenant who has already published … There is no way for them to discover why, and
> the manual fix … is not something the non-technical business owner this platform
> is for will ever do.

It describes when it runs ("on the DRAFT at studio load"), why that is safe, how
narrow each rule is, and when the rules should be deleted. It exports
`upgradeFrameChrome`. It has its own test file.

**Nothing calls it.** Across `piggles/` and `wizeworks/`, `upgradeFrameChrome`
appears in exactly three places: its own definition, its own tests, and two
comments in `site-service.ts` describing behaviour it does not have.

So both existing repairs have never run on anybody:

1. the legacy text-only brand node — a tenant uploads a logo and nothing happens;
2. the hardcoded `/privacy-policy` + `/terms-of-service` footer links — two
   guaranteed 404s in the footer of every site whose owner has not published those
   pages.

## What should have happened

The studio applies the heals when it loads a frame, exactly as its own
documentation says it does.

## How to reproduce

```
rg -n 'upgradeFrameChrome' piggles/ wizeworks/ --glob '!node_modules'
```

Three hits: the definition, the test, and two prose mentions. No call site.

## Why it matters

This is the defect shape that keeps recurring here, in its purest form: **the code
exists, the tests pass, and it does nothing.** Nothing is red. `upgrade-frame.ts`
is 200 lines of careful reasoning about a cohort of real tenants, and the cohort
was never touched.

It also silently changes what every future chrome improvement is worth. The
`host-nodes.ts` docblock tells you to "prefer making the thing LIVE (a host core)
over healing it" — sound advice that quietly assumed the healing path worked for
everyone already stranded. It did not, so every tenant who published before a core
existed is still stranded, and will be for each new core.

## Where it lives

- [wizeworks/packages/silica-catalog/src/upgrade-frame.ts](../../../../wizeworks/packages/silica-catalog/src/upgrade-frame.ts)
  — `upgradeFrameChrome`, exported from the package index, called by nothing.
- [wizeworks/packages/builder/src/services/site-service.ts](../../../../wizeworks/packages/builder/src/services/site-service.ts)
  — `rowsToStoredSite` is the studio's read half; it passes
  `layout.silicaDraftTree` straight through untouched. Two comments in the same
  file (around `resetFrame`) describe the heal as though it runs.

## The fix

Three things were wrong, not one. Each was hiding the next.

**1. Nothing called it.** `healFrameTx` now runs on both studio reads — `load`
(the whole-site open) and `loadFrame` (the header/footer pane, which is the read
an author actually makes when they go to look at their chrome). Wiring only the
first would have left the one pane that matters unhealed.

**2. It has to PERSIST, not heal in memory.** The module's docblock leans on the
`ensureUniqueIds` precedent — "the healed ids persist on the next autosave" — and
that precedent does not hold here. `publishFrame` republishes
`layout.silicaDraftTree` **straight from the row**, so an author who opened their
header and pressed Publish without editing would have pushed the stale tree back
out and silently undone a repair they had just been shown. The heal writes the
draft back inside the read's transaction. Draft only: the published tree is
untouched, so visitors keep the chrome they have until that publish.

**3. `healRegion` was looking one level too shallow.** It scanned the frame
root's DIRECT children for `<nav>`. A real frame is
`div > [header, main, footer]` with the navbar inside the `<header>`, so it found
no nav and did nothing — on every tenant. It now finds the first matching
DESCENDANT. "First `<nav>`" is still the scope the brand repair's blast radius is
argued from; only the depth it may sit at changed.

**Why the tests did not catch (3):** the fixture hoists `<nav>` to the top level.
It is shaped the way the code expects rather than the way the database is, which
is how a repair with eight passing tests repaired nobody. Three tests now use the
real stored shape, including one that fails outright under the old direct-child
scan.

**A fourth, found only by driving it:** the account repair could not be scoped to
`<nav>` at all — the seeded link sits in the header's END ZONE, a sibling of
`<nav>`, and its phone-panel twin is a `Button` COMPONENT whose destination is in
`props.href` rather than `attrs.href`. Matching on the tag found one of two and
scoping to the nav found neither. It keys on the `secondary` SLOT instead, which
the platform's own fill writes and nothing else does.

## Confirmed by

Watched in the database across four studio loads, which is what made each of the
three faults visible in turn:

| After                                   | `silica_draft_tree` |
| --------------------------------------- | ------------------- |
| load with nothing wired                 | stamped, unhealed   |
| load with the heal in `load` only       | stamped, unhealed   |
| load with `loadFrame` wired, nav-scoped | stamped, unhealed   |
| load with the region + slot fixes       | **healed**          |

The last one: `site.account-link` present, `/account/login` gone, `Your account`
in the footer — written back to the row, not just rendered. Devi then pressed
**Publish** and the published tree carries it too.

**The lesson, which is the same one this repo keeps paying for:** the code
existed, the tests passed, and it did nothing. Three separate faults stacked, and
every one of them was invisible to typecheck, lint and a green test file. Only
reading the row after clicking the screen found any of them.
