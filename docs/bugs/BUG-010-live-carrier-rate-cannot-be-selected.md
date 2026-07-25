# BUG-010 — A live carrier (Shippo) shipping rate can never be selected at checkout

Status: **✅ FIXED — VERIFIED IN PRODUCTION 2026-07-24 (v1.165.0)**

## Verified 2026-07-24 (prod, `keen-cedar-6433`, live Shippo)

Drove the public checkout API end-to-end against `api.sparx.works`. All four
verify-after-deploy items below pass:

- **Live rate selectable.** Quoted `shippo/USPS Ground Advantage $7.90`, submitted
  it → **HTTP 200** (was 422). The session persisted a shipping ref
  (`afdd71d1…`) DIFFERENT from the one the shopper submitted (`9b745bdb…`) —
  proof the re-quote + service-identity match is doing its job; the price
  (`shippingTotalCents: 790`) came from the fresh server quote, not the client.
- **Switch, no stacking.** Ground ($7.90) → re-pick Priority ($11.54): total
  became 1154, reflecting only the latest pick.
- **Manual still works.** `sparx-manual` flat rate ($5.00) submitted via the
  deterministic-ref path → total 500.
- **Stale rate rejected cleanly.** A bogus live service → 422 "That shipping
  option is no longer available…", and the session stayed on the last good pick
  (not corrupted to $0).
- **Charge == new total.** Payment-intent for a 2×$25 + $11.54 cart was created
  for exactly `6154` cents (`sparx_pay`, clientSecret present) — live carrier
  shipping flows correctly into the amount Stripe will charge.

Original code-fix writeup below.

---

Status (at fix time): **FIXED (code) 2026-07-24 — awaiting deploy**
Severity: **High** — with live carrier rates enabled, every checkout that picks a
real USPS/UPS/FedEx rate dead-ends; only the manual flat rate can complete
Found: 2026-07-24, production shipping E2E on `keen-cedar-6433` (Shippo just enabled)
Surfaces: `packages/commerce/src/services/checkout-service.ts` (`submitShipping`),
`packages/commerce-schemas/src/checkout.ts`, `services/api-rest/src/routes/v1/public/checkout.ts`,
`apps/site/components/checkout/checkout-flow.tsx`, `apps/site/lib/checkout-client.ts`

## Symptom

At checkout, `POST /checkout/:id/shipping` with a live Shippo rate returned:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "That shipping option is no longer available — please choose a shipping method again."
}
```

…every time, even when the rate was submitted **immediately** after the quote that
produced it. The shopper can see USPS Ground Advantage / Priority / Express in the
list (real rates come back fine), but selecting any of them is refused. Only the
`sparx-manual` flat rate can be submitted. Net effect: turning on a live carrier
makes checkout uncompletable for anyone who picks a real rate.

## Root cause

BUG-005's fix made `submitShipping` **re-quote** the cart server-side and match the
shopper's `shippingRateRef` against that fresh quote (so a client can't post a $0
shipping amount). That is correct for manual rates, whose `rateRef` is deterministic
(`manual:<zone-uuid>`) and identical across quotes.

**Shippo mints a brand-new, single-use `rateRef` on every rating call.** So the ref
the shopper saw belongs to quote A; `submitShipping` runs quote B and gets entirely
different refs; `rates.find(r => r.rateRef === input.shippingRateRef)` never matches;
the guard fires. The re-quote — the thing that made BUG-005 safe — is exactly what
makes a live rate impossible to match by ref.

This stayed invisible until now because the tenant had no live carrier configured
(only the manual flat rate, stable ref). Enabling Shippo surfaced it immediately.

## Fix

Match the chosen option by its **stable service identity** (provider + carrier +
service name), not the ephemeral ref — while still pricing from the fresh server
quote, so BUG-005's "no client-supplied amount" protection is fully intact.

- **`submitShipping`** now matches ref-first (manual rates unchanged), then falls
  back to `providerSlug + service + carrier` from the re-quote. The amount, provider,
  and the ref it persists all come from the freshly re-quoted option, never the
  client. Only if BOTH lookups miss does it raise the "no longer available" error.
- **`SubmitShippingInput` / `ShippingBody`** gained optional `shippingService` +
  `shippingCarrier`. Optional so manual rates and any older client keep working.
- **The storefront** (`checkout-flow.tsx`) forwards `rate.service` + `rate.carrier`
  (it already has them from the quote it rendered); `checkout-client.ts`'s type was
  widened to carry them.

Why not cache the quote on the session instead? That is the other standard fix, but
`CheckoutSession` has no rate-cache column and adding one needs a migration through
the pipeline — this code-only change ships now and needs no schema change.

## Verify after deploy

- Pick a live USPS/UPS rate → checkout advances to payment, the order's
  `shippingTotal` equals the chosen rate, and the Stripe charge equals the new total.
- Switch between two live rates → total reflects only the latest pick (no stacking).
- The manual flat rate still submits (ref match path unchanged).
- Submitting a genuinely stale service (carrier dropped it) → the clean "no longer
  available" message, not a silent $0 shipping.

## Prerequisite: the empty ship-from address (systemic — also FIXED)

Live rating needs a **complete ship-from warehouse address**. This is NOT tenant-
specific: `bootstrapDefaultWarehouse` seeded every new tenant's "Main Warehouse"
with `country: 'US'` and nothing else, so `resolveShipFromAddress` threw and
`tryLiveRates` swallowed it — **every** physical-goods tenant with a carrier
connected silently got manual rates only, no live options shown, no warning.

**Not a module gap.** `inventory` is `BUNDLED_FREE` with `commerce`/`b2b`
(`packages/modules/src/index.ts`), so any tenant that can check out already has the
full inventory surface at $0 — the warehouse always exists and the
`requireInventoryModule`-gated locations API is bundle-aware. Only a WMS-only tenant
(no commerce/b2b) pays for standalone inventory, and it isn't selling anyway. So the
problem was purely the empty seeded address, not a missing module.

**Two fixes shipped (this changeset):**

1. **Seed the ship-from from Business details.** `bootstrapDefaultWarehouse` now
   copies the tenant's registered/trading address from `tenant_businesses` (the same
   block invoices/POs use) into the Main Warehouse on create, so a tenant who filled
   in Business details during onboarding gets live rates out of the box.
2. **Make the degradation loud.** New `shippingService.getLiveRateReadiness()` +
   `GET /v1/commerce/shipping/readiness`; the workbench Shipping surface shows a
   warning when a carrier is connected but the ship-from is incomplete ("Live carrier
   rates are turned off right now — …finish your ship-from address…"). The shopper
   still just sees manual rates (checkout never breaks); the MERCHANT finally learns
   why the live prices aren't showing. Existing tenants (warehouse already created
   address-less, so the seed can't retro-fix them) are covered by this warning.
