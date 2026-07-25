# BUG-001 — Storefront silently swallows the out-of-stock add-to-cart 409

Status: **✅ FIXED — VERIFIED IN PRODUCTION 2026-07-24 (error path re-tested)**

## Verified 2026-07-24 (error path)

Created a dedicated `deny`-policy, 0-stock variant ("Sold Out Tester", since
archived) on `keen-cedar-6433` and clicked **Add to cart** on its storefront page.
Result: `POST …/cart/:id/items` → **409 `OUT_OF_STOCK`**, and the buy box settled to
an **error state with a visible message** (`status` element) — the cart drawer did
NOT open and no line was added. The old silent "Submitted." with an empty cart is
gone. Core bug fixed.

**Follow-up polish — FIXED (same session).** On the silica buy-box path
(`silica-behaviors.tsx` → silica `form` behavior) the surfaced text was silica's
GENERIC "Something went wrong. Please try again.", misleading for a permanent
sell-out. silica's form behavior announces the form's **`data-error-message`**
attribute (falling back to that generic string), so the fix is to set it from the
thrown `CartError` before re-throwing: the add-to-cart handler now does
`payload.form.setAttribute('data-error-message', err.message)` in its catch, so the
shopper sees the real reason — "Sorry, this item just sold out." for a 409 — matching
what the `<ProductDetail>` React path already shows. No silica change needed. All
three buy-box paths now surface the specific message AND keep the drawer shut.
Severity: High (a shopper believes an item is in their cart when it is not)
Found: 2026-07-24, during the production Stripe/payments E2E run
Reporter: Brandon Korous
Surface: `apps/site` — product detail page (PDP) add-to-cart

## Root cause + fix (2026-07-24)

The real defect was in `apps/site/components/cart-provider.tsx` → `addItem`: on a non-OK
response it skipped `applyApi` but **did not throw, and opened the cart drawer anyway**.
So the silica buy-box form behavior (`silica-behaviors.tsx`, which settles its visible
state from the awaited promise) saw a _resolved_ promise → showed its success state
("Submitted.") while the cart stayed empty. The interactive `ProductDetail` had the same
swallow.

Fixed at every render path:

- **`cart-provider.tsx`** — `addItem` now throws a `CartError` (exported; carries the HTTP
  `status`) on any non-OK response and does NOT open the drawer on failure. 409 → "Sorry,
  this item just sold out."; anything else → a generic add-to-cart failure message (the
  server's raw 409 text is developer-facing). The silica buy-box form now settles to its
  ERROR state instead of a false success.
- **`product-detail.tsx`** (legacy PDP) — `handleAdd` catches the throw and renders an
  inline `.st-buybox__error` message. Its disabled/"Sold out" button already covered the
  KNOWN-out-of-stock case; this covers the load→click race.
- **`packages/builder-render/src/commerce.tsx`** (builder buy box) — `addToCart`/`buyNow`
  now catch (no unhandled rejection from the fire-and-forget `void f.addToCart()`), expose
  `addError` on the form context, and the cohesive `BuyBox` renders it.
- **`apps/site/app/site.css`** — new `.st-buybox__error` (real `--st-danger` ink, not faded).

Verify after deploy: on a `deny`-policy sold-out variant, the storefront shows a real error
(not "Submitted.") and the cart stays empty with the shopper informed. (Original report below.)

## What happens

On a live storefront PDP for a product whose default variant is out of stock
(`inStock: false`) with the out-of-stock policy set to **"Stop selling it"** (`deny`):

1. The **"Add to cart" button is fully enabled** — no "Sold out" state, no disabled
   styling, nothing to tell the shopper the item can't be bought.
2. Clicking it fires `POST /v1/public/commerce/cart/{cartId}/items`, which correctly
   returns **409 Conflict** (the server refuses to add out-of-stock, deny-policy stock).
3. The UI shows only a status message reading **"Submitted."** — no error, no toast, no
   indication anything failed. The cart stays empty.

A real shopper would reasonably believe the item is in their cart, go looking for it,
and find nothing — or abandon, confused.

## Reproduction (verified live in prod)

- Tenant: `keen-cedar-6433` (test tenant "Keen Cedar 6433"), created this session.
- Product: "Test Widget" ($25.00), single variant `TEST-WIDGET-1`, 0 stock, policy `deny`.
- URL: `https://keen-cedar-6433.sparx.zone/products/test-widget`
- Click "Add to cart" → console shows
  `Failed to load resource: 409 () .../cart/{id}/items` and the on-page status reads
  "Submitted." The cart does not update.

## Expected

Two independent fixes, both wanted:

1. **Prevent the click.** When the resolved variant is out of stock under a `deny`
   policy, the PDP should render a disabled/"Sold out" button (and ideally a "notify me"
   affordance), not an active "Add to cart".
2. **Never fail silently.** If an add-to-cart request 409s (or errors any other way),
   the storefront must surface it — an inline error / toast ("Sorry, this item just sold
   out"), not a generic "Submitted." A background failure that the shopper can't see is
   the core defect.

## Notes

- This is **independent of payments** — it surfaced while seeding a product for the
  Stripe test, not in the payment path itself.
- Likely the same class as the previously-logged storefront "silent 409 on add-to-cart"
  observation in `docs/testing/e2e/checklist.md` (apparel-co / electronics-hub, §3), i.e.
  not a brand-new regression — but still unfixed and now reconfirmed in production.
- The correct way to make a product sellable for testing is to **receive real stock via
  the Inventory module**, not to flip the variant to backorder ("keep selling and owe
  it") — backorder is a real feature for pre-order/made-to-order sellers, not a
  workaround for un-received stock.

## Suggested code entry points (unverified — for whoever picks this up)

- PDP add-to-cart component in `apps/site/components/` (the `product-detail` / buy-box /
  add-to-cart island that posts to the public cart items route).
- The button's disabled/label state should read the same availability signal the public
  products API already returns (`inStock`) combined with the variant's out-of-stock
  policy.
- The mutation's error branch needs a user-visible error path instead of the current
  optimistic "Submitted." status.
