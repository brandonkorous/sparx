# 271 — The builder painted her site a color her visitors never saw

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · RULE #8 — comparing the canvas with the live page
**Surface:** mypiggles › My Site › Page (the canvas), against the published site
**Filed:** 2026-08-26
**Confirmed:** 2026-08-26

## What happened

Every primary control on her site is one color in the editor and a different
color to her customers:

```
builder canvas   --color-primary: #c77618   a warm amber
her live site    --color-primary: #e04631   a red-orange
```

Not a shade apart. Amber against red, on the closing band that fills a third of
a page, on "Get in touch" in her header, on every button she has placed.

I had been reading it as a rendering quirk for two sessions ("the builder canvas
renders her buttons amber while the published site renders them red, not
investigated"). It is not a quirk. It is the editor showing a color that no
visitor to this website has ever seen.

## Why it matters

- **It is the one promise a visual builder makes.** Every design judgement she
  makes on that canvas — does this heading sit well on the band, is that button
  loud enough, does this photograph fight the color — she makes against the wrong
  answer.
- **Nothing anywhere says so.** No warning, no "preview may differ". The canvas
  is confident and wrong, which is worse than a canvas that renders nothing.
- **It is silent to every automated check.** Both values are valid tokens, both
  resolve, both contrast fine. Typecheck, lint and the site checks are all green.
  The only way to catch it is to look at the same page twice, in two places.

## Where it lives

The two sides fell out of step and each carries a comment claiming they are in
step.

**The storefront** ([app/layout.tsx](../../../../wizeworks/apps/site/app/layout.tsx)):

```ts
const silicaThemeCss = buildSilicaThemeCssFromTheme(silicaFrame.theme ?? BASE_SILICA_THEME);
```

> "The legacy brand-derived tier (`buildSilicaThemeCss(compiledV2)`) is GONE:
> brand is identity-only now, so an un-themed site wears the base theme, not a
> brand-column compile."

**The canvas** ([lib/studio/host.tsx](../../../apps/workbench/lib/studio/host.tsx)),
before this fix:

```ts
const columns = applyBrandOverride(brand.data ?? EMPTY_BRAND, property.data?.brandOverride);
return tenantTheme(columns, { themeKey: config.data?.themeKey ?? 'default' });
```

Still compiling the brand columns, and `properties.brand_override.colorPrimary`
for Juniper Row is `#c77618`. The migration moved the storefront off that tier
and left the editor on it.

And the studio's own contract
([resolve/chain.ts](../../../../wizeworks/packages/studio/src/resolve/chain.ts))
states the invariant that had quietly stopped being true:

> "A site whose author has never opened the theme builder still renders in its
> own colors, **exactly as the storefront does**."

## The fix

The canvas falls back to what the storefront falls back to, and to the same
constant, not a copy of it:

```ts
buildHost({ fallbackTheme: BASE_SILICA_THEME, … })
```

`BASE_SILICA_THEME` is the platform default the served page already uses, so
there is now one value and no derivation to drift. A site that HAS published a
theme is untouched — `resolveTheme` reads the session's own theme store first
and only reaches the fallback when there is none.

The brand compile went with it, and so did the reason the host returned `null`
while `/v1/brand` was in flight ("a flash of somebody else's brand"): a constant
cannot arrive late, so the editor now opens on the right colors immediately.

## Confirmed

Read out of the live DOM in both places, on the same page:

```
canvas   --color-primary  #e04631
site     --color-primary  #e04631
```

The closing band on `/made-in-the-studio` is the same red in the editor and on
the page. The console's own chrome stays Piggles pink (`#ff7c91`), which is
correct and unaffected. Workbench typechecks; prettier and eslint clean.

## Named, not changed

**An un-themed tenant site wears sparx Ember.** `BASE_SILICA_THEME` is documented
as "the sparx Ember look", and `#e04631` is documented in the root CLAUDE.md as
sparx's own brand primary. So Devi's shop is red-orange because of a vendor she
has never heard of — the same complaint as [254], one layer down. Whether an
unthemed site should default to the platform's brand hue, a neutral, or a
prompt to pick one is a brand decision, not a bug to fix mid-run, so it is
recorded here rather than changed.

## Related

[[feedback_honor_the_users_choice]] — the general shape: a value applied to some
outputs and not others reads as the tool being broken. Here it is worse than
partial application, because the half that is wrong is the half she is looking
at.

[[feedback_test_as_a_business_owner]] — a green endpoint proves nothing. Two
screens agreed with themselves and disagreed with each other, and only opening
both caught it.

## Rating effect

The page editor, in [rating.md](../rating.md). Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
