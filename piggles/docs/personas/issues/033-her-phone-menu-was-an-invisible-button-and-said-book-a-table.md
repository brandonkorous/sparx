# 033 — On a phone, her only menu button was invisible — and said "Book a table"

**Status:** fixed
**Severity:** blocker (a bakery's customers are on phones, and had no navigation)
**Severity note:** two defects, one screen. Filed together because the second is
only reachable once the first is fixed.
**Found by:** P01 · Thistle & Rye · act 8 — reading the published site at 390px
**Surface:** the tenant's LIVE site (`apps/site`), header
**Filed:** 2026-08-20
**Fixed:** 2026-08-20
**Confirmed by:** P01 · act 8, on the screen at 390px

## What happened

Her site went live. Opened at 390px, the header was her name and nothing else —
no menu, no links, no button. A customer on a phone could reach the front page
and nothing beyond it.

The button was there. It was a 32×32 transparent square containing an empty
`<span data-icon="menu">`. Tappable, correctly positioned, correctly colored,
and completely invisible.

Tapping the spot it should be opened her menu — and its primary button read
**"Book a table"**, pointing at `/book`. Thistle & Rye is a bakery.

## Why it matters

Most of a bakery's traffic is a phone. The one control that opens navigation was
invisible on every tenant site the platform serves, and nothing anywhere reported
a problem: no console error, no failed request, no missing asset. The markup was
right, the CSS was right, and the icon simply was not drawn.

## The first defect — an empty icon

`toHtml` inlines an SVG for a CHILDLESS element carrying `data-icon`:

```js
const iconName =
  opts.icons !== false && !node.children?.length && typeof safeAttrs?.['data-icon'] === 'string'
    ? safeAttrs['data-icon']
    : undefined;
const iconMarkup = iconName != null ? iconSvg(iconName, opts.icons || undefined) : undefined;
```

The page BODY renders through `toHtml`, so icons in a page work. The FRAME does
not: it is walked to React by `walk()` in
[silica-chrome.tsx](../../../../wizeworks/apps/site/components/silica-chrome.tsx),
which the file describes as mirroring `toHtml`'s emission — and which mirrored the
class, the attributes and the meta markers, but never the icon branch. So every
icon a tenant puts in their header or footer rendered empty on the live site while
rendering correctly everywhere else.

**Fixed** by mirroring the branch, with the same childless + `data-icon`
condition. The SVG is silica's own bundled Lucide set keyed by name, never tenant
input, so an unknown name yields nothing rather than anything injected.

## The second defect — a label no screen could change

The starter chrome authors its call to action as a COMPONENT node:

```json
{
  "kind": "component",
  "component": "Button",
  "class": "btn btn-primary btn-sm hidden @md:inline-block",
  "props": { "label": "Book a table", "href": "/book" }
}
```

The Inspector's Settings tab read `ownText` (text CHILDREN) and `attrs.href`, and
a component node has neither — its words and its destination are PROPS. So the
panel showed no Words box and no Goes to box, and the only way to change a
starter's header CTA was to delete the button.

`node.setProp` had existed in the ops union the whole time. It was simply never
offered. **Fixed** in
[settings-tab.tsx](../../../../wizeworks/packages/studio/src/react/inspector/settings-tab.tsx):
a component node now gets Words and Goes to, reading and writing its props. Both
boxes are keyed on their value like every other field here, so [#027](027-she-typed-new-words-on-the-page-and-the-box-beside-them-put-the-old-ones-back.md)
cannot recur through them.

## Confirmed by

Re-run as Marisol at 390px, 2026-08-20:

1. The hamburger renders — `<span data-icon="menu"><svg …>`.
2. Tapped it: her four pages open — What we bake · Order · About · Find us.
3. The CTA is hers: **Order for collection → /order**, on the phone menu and on
   the desktop header, edited through the boxes that did not exist an hour ago.

**Not chased:** the builder CANVAS also draws that icon as an empty box. Same
symptom, different renderer, and author-facing rather than customer-facing —
worth its own look.

## Rating effect

None recorded yet — the published site has not been scored.
