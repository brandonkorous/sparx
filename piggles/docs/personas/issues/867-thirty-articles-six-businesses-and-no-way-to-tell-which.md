# 867 — Thirty articles, six businesses, and no way to tell which

**Status:** fixed
**Severity:** **major** — a page or post belongs to some of the business's
websites, or to all of them. The endpoint sends that on every read, and its own
comment names the control it is for: "the editor needs the current site scope to
pre-fill its **'Visible on sites'** control". **That control was never built.** So a
page written on the Press site could not be shown on the Journal, nothing on
screen said which site a page belonged to, and the nine other editors that have
this exact field made content the odd one out
**Found by:** P03 · act 307, opening Content with the dev ports down, from the
code and the database
**Surface:** mypiggles › Content › a page or post, in both consoles
**Filed:** 2026-09-28
**Fixed:** 2026-09-28
**Confirmed by:** three new tests against the live database, proved red

## Her own data

Juniper Row runs **seven websites** and has thirty pieces of content:

```
Juniper Row Sample Sale   10 pages pinned to it
Juniper Row                6
Juniper Row Lookbook       5
Juniper Row Press          5
Juniper Row Archive        3
Juniper Row Journal        3
                          --
                          24 pinned to one of six sites
                           6 on every site
```

Platform-wide: **154 junction rows across 143 entries.** The feature is in daily
use. It works because the create endpoint defaults a new page to the site it was
written on, with the reason written down:

```ts
// Model B (docs/49 §3): default a new entry's site scope to the ACTIVE site
// for multi-site tenants (so "New page" authored on site B belongs to site
// B, not every site). An explicit `property_ids` (including `[]` = all
// sites) is honored…
```

That default is right, and it is the only thing deciding this for her. Once a page
is pinned, **no screen could ever change it or show it.**

## The shape of the gap

```
GET  /v1/content/entries/:id   returns `propertyIds`   ← for a control that
                                                          does not exist
PATCH /v1/content/entries/:id  accepts `property_ids`  ← nothing sent it
POST  /v1/content/entries      accepts `property_ids`  ← nothing sent it
GET  /v1/content/entries       filters by active site  ← works
```

The console's type declared it and no `.tsx` in either console mentioned it:

```ts
/** Only present on GET one — the sites this entry publishes to (empty = all). */
propertyIds?: string[];
```

[[feedback_fetched_but_never_rendered]]

## What she saw instead

On the Journal, Content showed nine rows: the Journal's three, plus the six that
are on every site. On the Press site, eight rows: its five, plus the same six.
Nothing distinguished the shared six from the pinned ones, on either screen. Edit
one of the six and she is editing something all seven of her businesses publish,
with no indication at all.

## What it does now

The **shared `SiteScopeField`** — already used by quick replies, categories,
collections, discounts, price lists, invoice templates, locations, resources and
authors — is now on the content editor too:

```
Which of your sites show this
You run more than one website. A page kept to one of them stays off the others.

Show it on every site                                        [ ○ ]
Turn this off to choose the sites it applies to.

  ☑ Juniper Row Journal
  ☐ Juniper Row Press
  ☐ Juniper Row Lookbook
  …
```

It renders **nothing at all** for a business with one site, which is the rule that
field already follows: there is no choice to make, and a control naming "sites"
would invent one. Reaching for the shared field rather than writing a tenth copy
is the whole reason it exists. [[feedback_silicaui_single_point_of_change]]

Changing which sites show a page counts as an edit, so it is in the dirty check and
the leave-guard asks before losing it.

**The create form is deliberately untouched.** The server's active-site default is
correct and sending an explicit list from a create form would switch that default
off. She creates on the site she is standing in, then widens it here.

## The second bug, found while fixing the first

The PATCH response did **not** carry `propertyIds` — only GET-one did. With a
control now holding the scope in its draft, that response reads as `undefined`, and
the "every site" shape spells itself as the **empty list**. So:

```
pin a page to the Journal → Save → the pane redraws showing "every site"
                                 → the next Save widens it, for real
```

A missing field would have quietly undone the control on its second use. The PATCH
now returns the scope, which is what makes the write agree with the read.
[[feedback_absent_behaves_like_fine]]

Two smaller versions of the same trap were closed with it: after a save and after
restoring an older version, the pane rebuilds its draft, and both now carry the
scope forward rather than defaulting to the empty list. A restore brings the
writing back, not which sites show it.

## Proved

**Three new integration tests** against the live database, proved red by taking the
echo back out:

```
drop the propertyIds echo from the PATCH response → 3 of 11 fail
```

The third of them is the partial-update footgun, which had to be pinned in both
directions: an omitted `property_ids` must leave the scope alone, or every ordinary
save from any editor without the control would unpin every page on the platform.
It does (`if (input.propertyIds !== undefined)` in `updateEntryTx`), and now a test
says so.

**Checks:** typecheck 0 on `api-rest` and both workbenches. Tests: entries
lifecycle 11/11 against the real DB. ESLint and prettier clean.

## Files

- `wizeworks/services/api-rest/src/routes/v1/content/entries.ts` (the PATCH echoes the scope)
- `wizeworks/services/api-rest/test/integration/entries-lifecycle.test.ts`
- `{piggles,sparx}/apps/workbench/surfaces/cms/data.ts` (`property_ids` on the write)
- `{piggles,sparx}/apps/workbench/surfaces/cms/content-detail.tsx` (the control)

## The thing to remember

**A comment naming a control is a claim that the control exists.** The endpoint
said "for its 'Visible on sites' control" and the next person to read that line
would reasonably believe the feature shipped. The field was serialized, the write
accepted it, the default populated it, the list filtered on it, and the one thing
missing was a checkbox list that already existed as a shared component nine
editors away. [[feedback_a_fix_leaves_its_neighbour_behind]]

And the general form: a capability implemented in four layers and absent from one
is harder to see than a capability nobody built, because every layer you check
looks right.

## Also checked on this surface, and dropped

- **`focalX` / `focalY` on a media asset, and `focal_point_x` / `focal_point_y` on
  its write shape**, are declared on both sides and used by neither. So the "which
  part of this picture matters" feature is reachable from nothing in either
  console. Same family, its own issue, not folded in here.
- **`needsReview` on the legal status**, `currentVersion` / `templateVersion` on a
  checklist entry, and `archived_at` / `locale_code` / `parent_entry_id` on a
  content entry are all fetched and drawn nowhere. Noted for a later pass.
- **A content list column showing which sites a page is on** would need
  `propertyIds` added to the list serializer, a join on a 250-row query. The editor
  is where she acts and where the harm was, so the column is deferred rather than
  bundled.
