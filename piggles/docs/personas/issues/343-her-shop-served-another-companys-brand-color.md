# 343 — Her shop served another company's brand color

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · opening `/category` while checking the browse pages
**Surface:** the published site › every page, intermittently — and every un-themed site, always
**Filed:** 2026-08-29
**Fixed:** 2026-08-30
**Confirmed by:** a live un-themed Piggles shop, whose page now contains the other brand's hex zero times

## What happened

Opening `/category` on her live site, cold: white page, slate ink, sans-serif headings,
and a **red** "Get in touch" button. Her site is cream, warm near-black, Fraunces, and
amber. Measured on the two pages side by side:

|                        | `/products` (correct) | `/category` (wrong) |
| ---------------------- | --------------------- | ------------------- |
| `--color-primary`      | `oklch(64% 0.14 62)`  | **`#e04631`**       |
| `--color-base-100`     | `oklch(97% 0.016 88)` | `#ffffff`           |
| `--color-base-content` | `oklch(25% 0.02 45)`  | `#0f172a`           |
| body background        | cream                 | slate-50            |

`#e04631` is the other product's brand primary. On a Piggles tenant's storefront.

Reproduced on `/category/tops`, a route I had not opened, on its first load. Reloading
the same address served her theme correctly, which is why it took a second look to see:
it is intermittent, not a broken page.

## What should have happened

Her site wears her brand, or something that belongs to nobody. Never another
company's.

## Why it mattered

**It was not a styling wobble, it was a different company's logo colors on her shop.**
A shopper who lands on that page sees a business whose site does not match itself.

**The two products are supposed to be unable to touch each other.** The storefront app
(`wizeworks/apps/site`) is legitimately shared by both brands' tenants — `wizeworks/CLAUDE.md`
says so in as many words, and adds the rule this broke: _"A tenant site must render
identically under either."_ Its last-resort theme was one brand's, so the shared
surface leaked that brand into the other's customers' sites.

**It failed silently and looked fine.** No error, no blank page, no console warning — a
complete, well-composed page in the wrong colors. [[feedback_absent_behaves_like_fine]].

## The two causes, because there were two

Neither line was wrong on its own, which is why this took a while to see.

**1. A failed lookup and an unpublished theme were the same `null`.**
[lib/silica.ts](../../../../wizeworks/apps/site/lib/silica.ts) turned every failure into
"no answer":

```ts
} catch {
  return null;          // a timeout, a refused connection, a blip
}
```

That `null` falls through `getPublishedSilicaFrame` to `starterFrameDto(...)`, whose
`theme` is null — the same value a tenant who has genuinely never published a theme
produces. **Two different questions sharing one `null`**: _"this tenant has no theme"_
and _"we could not find out what this tenant's theme is"_. The first has a sensible
default. The second does not — she HAS a theme, and it was painted over because a
fetch failed.

**Proved rather than inferred.** On the failing render the `data-silica-theme` style
tag itself contained `#e04631`; on a good render of the same URL it contained her
amber. Not CSS ordering, not specificity — the server resolved the wrong theme and
emitted it. The API was fine, returning her theme every time it was asked directly.

**2. The default it fell back to was a product's flagship look.**

```ts
export const BASE_SILICA_THEME: Theme = {
  name: 'sparx',
```

Its own header said so: _"the platform's default site theme… It IS the golden
template's captured theme."_ A sensible default while the platform served one brand,
and straightforwardly wrong afterwards.

The same failure had already been diagnosed one layer over, for the colors a PLATFORM
email paints itself in, and `@wizeworks/brand-core`'s email palette states the rule
this file was breaking:

> A brand-blind fallback that happens to be one brand's palette is the same bug
> wearing a default, and it is worse than an obvious one because it renders
> perfectly.

## The fix

**Both halves, because either alone leaves it broken.** The retry makes the
wrong-theme render rare; the neutral base makes it harmless when it still happens.

### The base belongs to nobody now

`BASE_SILICA_THEME` is silicaui's own house baseline, `quartz` — the preset that
states no type and no shape, one cool-mineral family for structure and a single
reserved accent for interaction. It belongs to no product and is maintained upstream.

An earlier draft of this issue said making the base neutral "needs a designed neutral,
not just a hue swap." That was wrong, and finding out it was wrong is what made the
fix cheap: **silicaui already ships one**, and nothing new was needed from it.

Three roles silica does not model are derived exactly as `resolveSparxTheme` derives
them for all forty shipped themes — `danger`←error, `highlight`←accent,
`border`←base-300 — so the floor and the catalog agree about what those names mean.
Nothing in the file invents a color.

**A side effect worth naming: the platform default now clears AA.** The old base
carried two identity pairs under WCAG AA for normal text — white on that primary at
4.13:1, near-white on its accent at 3.83:1 — held as a documented exception in
`v2.test.ts` because they were the shipped brand and the base had to match what sites
rendered. Nothing is owed to a brand board any more, so the floor in that test is
raised from AA-Large (3.0) to AA (4.5). The tightest pair now is light `secondary` at
4.57:1.

**And it names no webfont.** The old base pulled two Google families on every
un-themed page. The new one is a system stack, which is what silicaui's own baseline
declares, so an un-themed site fetches no font at all.

### The lookup says when it could not read

[lib/silica.ts](../../../../wizeworks/apps/site/lib/silica.ts) keeps the three outcomes
apart instead of collapsing them:

```ts
type FrameRead =
  | { kind: 'ok'; data: PublishedSilicaFrameDto }
  | { kind: 'empty' }
  | { kind: 'failed'; reason: string };
```

`empty` is the API answering that nothing is published — asking again gets the same
answer. `failed` is not an answer at all: a refused connection, a reset socket, a 5xx.
That one is retried once, immediately, which covers what actually happens in
practice. A failure that survives the retry is **logged** rather than swallowed,
naming the tenant and the reason, because a silent degradation is how this went
unnoticed for as long as it did: the page renders perfectly, so only a person looking
at the colors can tell.

### Kept in step across four packages

The base is stated in four places for four different reasons, and a change applied to
some of them is a shop whose receipts stop matching its own storefront:

| Where                           | Why it exists                                  |
| ------------------------------- | ---------------------------------------------- |
| `silica-catalog/base-theme.ts`  | what the storefront renders                    |
| `silica-catalog/base-theme.css` | Tailwind needs the keys declared at BUILD time |
| `site-themes/presets/v2.ts`     | the v2 compile path                            |
| `site-themes/presets/index.ts`  | v1 — transactional email's fallback palette    |

They are now held together by tests rather than by care, each naming the exact key
that drifted:

- **`base-theme.test.ts`** (new) — the bag against silicaui's own `quartz` preset,
  read out of the upstream package, so a silicaui upgrade that moves the baseline is
  loud instead of silently ignored.
- **`base-theme.css.test.ts`** — the CSS against the bag (already existed).
- **`v2.test.ts`** — every hex re-derived from the upstream OKLCH using this package's
  OWN converter, so a hand-edited value fails. `@wizeworks/site-themes` is
  dependency-free by design and cannot import the constant, so this is the only honest
  check available from inside it.
- **`brand-service.test.ts`** — the site's base and email's base agree. This is the
  one place they can be compared: `email-platform` is the only package that depends on
  both.

Two more copies of the old values were deleted rather than updated:
`compile.test.ts` spelled the base's colors out as literals, which made it a third
place the base was written down — one that had to be hand-edited every time the base
moved and said nothing when it wasn't. It reads them off the constant now.

**`themePresetForSlug` was pointing a brand's slug at the base.** `PLATFORM_SLUG` was
the literal `'sparx'`, correct only while the base WAS that look; moving the base would
have left a brand slug resolving to a palette that is no longer that brand's, and
nothing would have reported it. It reads `BASE_SILICA_THEME.name` now, so the two
cannot disagree.

## Confirmed on a live shop

`marrow-review`, a Piggles tenant with no published theme, served from the running
storefront:

| Checked                              | Before                           | After                         |
| ------------------------------------ | -------------------------------- | ----------------------------- |
| occurrences of the other brand's hex | in the theme block on every page | **0 in the whole document**   |
| `--color-primary`                    | `#e04631`                        | `oklch(42% 0.055 252)`        |
| `--font-sans`                        | `'Inter', …`                     | `ui-sans-serif, system-ui, …` |
| Google Fonts request                 | Space Grotesk + Inter            | only her own `Nunito`         |
| OG card accent                       | —                                | `ff6f86`, Piggles' own        |

And Juniper Row's `/category` — the page this was found on — still resolves HER theme:
amber `oklch(64% 0.14 62)`, Fraunces, cream.

Tests: silica-catalog **1312** across 37 files (was 1306/36), site-themes **77** across
8 (was 72/7), sitebuilder 46, email-platform 18, surface-compile 47, blueprints 47,
site-lint 388, builder 135. Typecheck clean on silica-catalog, site-themes,
sitebuilder, email-platform and `apps/site`; eslint clean on the two `apps/site` files;
`check:boundaries` green. Both new tests were proved RED before green.

## What this uncovered, and it is the same defect one path over

Checking the four live Piggles tenants with no theme of their own, **three of them
still served the other brand's hex** — not in the theme block, in the **social card**:

```
sleek-orchard-5021   accent=e04631
noble-comet-3713     accent=e04631
sunny-summit-1198    accent=e04631
marrow-review        accent=ff6f86   ← correct
```

That is the Open Graph image a shop posts to Instagram or pastes into a message,
painted in a company its owner has never heard of.

It is the same defect on the v1 compile path rather than a new one. None of the four
has a brand row or a site-theme row, so `effectiveTheme` falls to
`tenantTheme(EMPTY_BRAND, …)` → `PLATFORM_PRESET_V2`, which was the old base.
`marrow-review` differs only because it has a stored theme of its own. **So the change
above fixes these three too** — they will compile to the neutral the moment api-rest
restarts, which is the user's to do, not mine.

Rather than claim that from reasoning, it is pinned:
`site-themes/src/v2/brand-theme.test.ts` (new) compiles a tenant who has themed
nothing and asserts the result is the platform base and carries no product brand
color, in either direction. Proved red against the old value.

## Noticed in passing, not fixed here

`sitebuilder/src/mcp/theme-tools.ts:43` describes `basePresetKey` to an AI client as
_"a platform preset key (apex, …)"_. The six presets it names — apex, industrial,
drift, market, fleet, drop — were retired when the silica catalog landed, and
`presets/index.ts` says so. A tool description naming keys that resolve to nothing is
its own small issue; recorded rather than folded in.

## Rating effect

Against `P03 site — Juniper Row`, every page, and against every un-themed site on the
platform. Closes the platform half outright.
