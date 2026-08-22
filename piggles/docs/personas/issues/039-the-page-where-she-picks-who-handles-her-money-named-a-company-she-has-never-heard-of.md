# 039 — The page where she picks who handles her money named a company she has never heard of

**Status:** fixed — the whole payments block, 18 strings
**Severity:** major (a Piggles owner, on a money screen, reading another company's name seven times)
**Found by:** P01 · Thistle & Rye · act 8 — following [#038](038-her-customer-was-told-to-go-to-a-settings-screen-they-cannot-reach.md)'s **Set this up**
**Surface:** mypiggles › Sell › Payment providers
**Filed:** 2026-08-21 · **Fixed:** 2026-08-21
**Confirmed by:** P01 · act 8, on the screen

## What happened

**Choose how you get paid**, seven rows, and under six of them:

> No **sparx** fee — you pay Stripe's rates directly.
> No **sparx** fee — you pay Square's rates directly.
> No **sparx** fee — you pay your Authorize.net rates directly.
> …

Marisol signed up to Piggles. She has never heard of sparx. This is the screen
where she decides who handles her customers' money.

## Why it matters

Of every surface for this to happen on, a payments picker is the worst. The
question it asks is _"who do you trust with the money"_, and the answer is
littered with the name of a company the reader cannot place. It does not read as
a branding slip; it reads as though something else is in the transaction.

`check:brand` had this on its debt list and its header called payments **"THE
AWKWARD ONE, and the reason it is not done yet"** — 24 of the 79 known strings.
It stayed there because the difficulty was real: `GATEWAY_CATALOG` is a static
`readonly` array served over an API mirror, so there is no brand in scope at the
point the strings are written. What moved it was walking a persona into the
screen and reading it as her.

## The fix — the shape the check's own header predicted

- The data carries **`{platform}`** (`PLATFORM_TOKEN`, `@wizeworks/brand-core`)
  instead of a product name.
- `gatewayCatalog(brand)` and `getGatewayDescriptor(id, brand)` resolve it,
  memoised per resolved name.
- **The raw array is no longer exported.** That is what closes the trap the
  header warned about — "converting the data and leaving a caller reading the raw
  array", where an unresolved `{platform}` on a live screen looks exactly like
  working software. A caller cannot forget, because there is no unresolved value
  to reach.
- The one boot-time consumer that genuinely has no brand — the integration
  registry, built once for every brand at once — goes through
  `gatewayCatalogTemplate()`, named to be alarming, and the ROUTE serving those
  descriptors resolves per tenant. That also caught `vendor: 'sparx'` and
  `publisher: 'sparx'` on every first-party row of the integrations shelf.
- **"sparx Pay" was a RESOLVE, not a REMOVE.** It is a real first-party product
  and the Piggles one is Piggles Pay. Its `id` stays `sparx_pay`: a wire value
  and a stored column, read by adapters and by rows already in the database, seen
  by nobody.

`check:brand` went **79 → 61** and the payments block is gone. The check's
"WHERE THIS STANDS" header is rewritten to say so rather than still calling this
the undone one.

## Two things this exposed

- **`api-rest` had no brand names in its local `.env`.** With them unset,
  `platformBrandIdentity` falls back to the brand KEY, so the first confirmed run
  read "No **piggles** fee" — right product, wrong case. Case is configured and
  never computed, precisely because sparx is deliberately lowercase and Piggles
  deliberately capitalised. Its `.env.example` had carried the values all along;
  nobody had copied them across. Same for `wizeworks/apps/site`, which had no
  brand configuration at all — see [#037](037-every-product-she-typed-in-said-sold-out-on-her-own-shop.md).
- **Nine tests** now cover the resolution, including the one that matters most:
  no readable string on any descriptor still contains `{platform}` for either
  brand.

## Confirmed

Reloaded the pane: **"No Piggles fee — you pay Stripe's rates directly."** on
every row, capitalised correctly.
