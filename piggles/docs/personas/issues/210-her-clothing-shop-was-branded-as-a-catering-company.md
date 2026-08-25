# 210 — Her clothing shop was branded as a catering company

**Status:** fixed and confirmed
**Severity:** major
**Found by:** P03 · Juniper Row · act 5
**Surface:** mypiggles › My Site › Your site — and the sparx marketplace listing for every tenant
**Filed:** 2026-08-25
**Fixed:** 2026-08-25
**Confirmed by:** P03 · Juniper Row · act 5, on screen and across nine tenants

## What happened

Devi opened **Your site** to work on her homepage. Her name was right. Under it:

```
Tagline
Seasonal food for occasions that matter.
An optional short phrase shown beside your name in some layouts.
```

She makes clothes in small runs. Read from the live field, on a cold load after a
dev restart, so it is a stored value and not a placeholder:

```js
{ ph: "A short line that sums up what you do",
  val: "Seasonal food for occasions that matter." }
```

Her site's stored brand is a **catering company's, entire**:

```json
{
  "businessName": "Saffron & Sage Catering",
  "tagline": "Seasonal food for occasions that matter.",
  "colorPrimary": "#c77618", "colorAccent": "#6b835f", "colorSecondary": "#44342e",
  "fontHeading": "Fraunces", "fontBody": "Inter"
}
```

That is `sparx-catering-events` — saffron, sage, and a serif. She installed
`sparx` and then `sparx-retail-apparel-minimal`, which ships as **Kestrel**:
"Fewer, better clothes", near-black `#1f1c19`, Cormorant Garamond. Her media
library is full of `kestrel-*` files, so the apparel install certainly ran.

Her live homepage still downloads the catering font on every visit, in five
weights, and renders it nowhere:

```
fonts.googleapis.com/…family=Fraunces:wght@400;500;600;700;800&display=swap
```

## It is not her, it is everybody

Every tenant in the database is wearing a sample company's name:

| The business        | What its site is branded as |
| ------------------- | --------------------------- |
| **Juniper Row**     | Saffron & Sage Catering     |
| **Thistle & Rye**   | Kettle & Crumb              |
| **Halo & Hem**      | Maison Élan                 |
| **Everson Apparel** | Farm Fresh                  |
| **Harbor & Pine**   | Tempo                       |
| Twenty-odd others   | sparx                       |

For all of them but Devi the name matches the blueprint they installed, so the
rule is plain: **installing a template stamps the demo business's identity onto
the real one.** Thistle & Rye is a bakery with a name Marisol chose in act 1 and
has been trading under for a year of this run.

## Why it matters

`brand_override.businessName` **outranks the site's own name** in the sparx
marketplace listing:

```ts
// commerce/src/services/market/projection.ts
const name = override.businessName ?? property?.name ?? tenant?.slug ?? 'Merchant';
```

So on the marketplace Juniper Row is listed as Saffron & Sage Catering, and
Thistle & Rye as Kettle & Crumb. That is the platform introducing a real business
to the public under a name that is not theirs.

**And the console gives her no way to change it.** The identity pane edits the
tagline, the logos and the favicon; `businessName` is not in `IdentityFields` and
not in `OVERRIDE_FIELDS`, so the value that names her in the marketplace cannot be
reached from any screen. A wrong value nobody can correct is worse than a wrong
value.

The tagline she CAN reach, and it is a false statement about her business sitting
in a field labelled as hers, ready for the first layout that renders it.

## What the repo had already decided

`businessName` on the override is **deprecated for naming**, and there is a
backfill whose entire job is to delete it —
[backfill-property-name.ts](../../../../wizeworks/packages/db/scripts/backfill-property-name.ts):

```
// 2. `brand_override.businessName` is deprecated for naming — strip the dead key so
//    brand_override.businessName → tenant_brands.business_name → current name
```

Two places never followed that decision:

1. **`installBrandSlice` writes the key back** on every install, re-creating exactly
   what the backfill exists to remove. The migration is undone by the next install.
2. **The marketplace still prefers it** over the live name, so wherever the dead key
   survives it wins.

The same function is careful in the other direction, four lines down, about
`Property.name`:

> seed it from the blueprint ONLY when it's still the seed placeholder
> 'Default'/empty, **never clobbering a name the merchant already chose**

The name got that protection. The brand did not, and it is the same merchant's
same name.

## What I could NOT determine, said plainly

**How the CATERING brand specifically reached Devi's site is unresolved.** The key
set in her override is `installBrandSlice`'s exact output (businessName,
tagline, the four colors, the two fonts, no logos), and there is no
`sparx-catering-events` row in `tenant_blueprint_installs` for her. The only other
writer, `applyThemeBrandToSiteOverrideWithinTx`, provably cannot be it — it
carries colors, fonts and tokens and never touches those two keys — though her
audit log does show a theme applied at `00:51:57` on 2026-08-25 and deleted forty
seconds later.

So an install ran without leaving a row, or a row was removed. I could not prove
which, and I am not going to invent the half I cannot show. **The fix below does
not depend on it**: the systemic defect is that installs stamp a sample identity
at all, and that is visible on all nine tenants I checked.

## The fix

**A template gives you a LOOK. Your name and your words are yours.**

1. **The installer stops writing the deprecated `businessName`.** It writes the
   look — colors, fonts, logos, favicon — and leaves naming to `Property.name`,
   which is what the console edits and the storefront renders.
2. **It no longer stamps the sample's tagline.** A blank tagline renders as
   nothing, which is honest; a catering slogan on a clothing shop renders as a
   lie. A tagline the merchant HAS written is preserved, because the write now
   merges onto the existing override instead of replacing it — a re-install used
   to wipe her sentence.
3. **The marketplace prefers the site's own name**, with the dead key as a
   fallback only. This is the part that matters most: it repairs every
   already-installed tenant immediately, with no migration and no backfill run.
   Thistle & Rye gets its name back the moment this ships.

## What it looked like once fixed

The nine tenants above resolve to their own names. Devi's tagline field is hers to
write, cleared through the console like any other edit — and the next install onto
her site will leave it alone.

## Rating effect

`My Site › Your site` in [rating.md](../rating.md).
