# BUG-002 — sparx Pay charge succeeds but the order stays "Not paid" (webhook↔complete race + resend-proof dedupe)

Status: **FIX IMPLEMENTED — awaiting deploy + prod re-test** (was: GO-LIVE BLOCKER)
Severity: Critical — real customers get charged; order shows unpaid; no receipt; no `order.paid`
Found: 2026-07-24, production Stripe/payments E2E run (Stripe **sandbox** keys in prod)
Fixed (code): 2026-07-24 — all three parts landed in the working tree (typecheck + lint green);
not yet deployed, so `O-000001` is still stranded until deploy + a Stripe resend (see recovery).
Owner surfaces:

- `packages/commerce/src/services/checkout-service.ts` → `complete()` (threads `paymentRef`/`paymentProviderSlug` out)
- `services/api-rest/src/routes/v1/public/checkout.ts` → complete route (Part A call, post-commit)
- `services/api-rest/src/lib/payment-webhook-reconcile.ts` → `reconcilePaymentEvent` (Part B), `reconcileCompletedCheckoutPayment` + `sweepStrandedCheckoutPayments` (Parts A/C)
- `services/api-rest/src/routes/internal/commerce-cron.ts` + `k8s/cronjobs/commerce-payment-reconcile-sweep.yaml` (Part C cron)

---

## TL;DR

The entire payment stack works EXCEPT the final "mark the order paid" step. A real
sandbox checkout charged the card (Connect **destination charge** to the merchant, **0.5%
`application_fee`** captured, Stripe webhook **delivered + 200-acked**), but order
`O-000001` is stuck **"Not paid."** Root cause is a **race**: because the card is confirmed
**client-side** (Stripe Elements), Stripe fires `payment_intent.succeeded` the instant the
charge succeeds — _before_ the browser's follow-up `complete()` call has created the
`OrderPayment` — so the reconciler finds nothing to reconcile and no-ops. Then the order is
created as `pending` and nothing ever re-flips it. A webhook **Resend does not fix it**
either, because reconciliation dedupes on the Stripe **event id** and early-returns on the
redelivery.

**Product decision (Brandon, 2026-07-24):** a webhook **resend SHOULD mark the order paid**
— that's a desirable recovery path for the platform ("there will always be hiccups"). So
the fix must make reconciliation **idempotent-by-effect and re-runnable**, not gated by
event id. In testing the stranded "Not paid" state is acceptable until the fix ships.

---

## Where the whole E2E run stands (2026-07-24)

Test tenant created for this run — reusable to resume:

- Tenant "Keen Cedar 6433", slug `keen-cedar-6433`, tenant id `005ed4ee-e78c-411d-bc52-80fd637e9858`
- Staff login: `bkorous+paytest@gmail.com` / `SparxPayTest-2026!`
- Storefront: `https://keen-cedar-6433.sparx.zone` (PDP `/products/test-widget` works; **`/shop` 500s** — page-composition, see note)
- Product "Test Widget" $25.00, SKU `TEST-WIDGET-1`, 100 units on hand (received via Inventory)
- sparx Pay connected account `acct_1TwbFDF5zEYX8zFH` — `charges_enabled: true`, `payouts_enabled: true`, bank STRIPE TEST BANK ••6789
- Stripe webhook endpoint "captivating-finesse" (Active) → `https://api.sparx.works/v1/public/webhooks/sparx-pay`, subscribed to `payment_intent.succeeded`, secret matches (delivers 200)
- The proof charge: PaymentIntent `pi_3TwgEFFY8gqB2fvj0yU3jJ90`, event `evt_3TwgEFFY8gqB2fvj0LfqpoeF`, order `O-000001`

| Stage                                                                       | Result                                                                              |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| STRIPE_CLIENT_ID wiring (onboarding Connect OAuth)                          | ✅ reaches Stripe consent (`ca_UmfoOqHR86w7L1DVnmH5qlRnkIdjvPdd`)                   |
| Settings → Payments UI (7 gateways + new stripe_direct webhook-URL surface) | ✅                                                                                  |
| sparx Pay Express onboarding                                                | ✅ charges + payouts enabled (**needed a real, non-headless browser** — see gotcha) |
| Pre-gateway checkout "not configured" message                               | ✅ clean                                                                            |
| Payment Element mounts in prod                                              | ✅ (publishable-key **build-arg** fix works)                                        |
| Charge = destination charge to merchant + 0.5% fee                          | ✅ `application_fee_amount: 13`, `transfer` created                                 |
| Order + pending OrderPayment created                                        | ✅ `O-000001`, "sparx_pay · Waiting"                                                |
| Webhook delivered + acked                                                   | ✅ `200 {"received":true}`                                                          |
| **Order flips to paid**                                                     | ❌ **THIS BUG**                                                                     |
| Refund                                                                      | ⛔ blocked — needs a paid order (blocked by this bug)                               |
| Declined card `4000…0002`                                                   | ⬜ not yet run (independent — can test anytime)                                     |
| Finance → Payouts (balance + Express dashboard link)                        | ⬜ not yet run (account onboarded — can test)                                       |
| stripe_direct leg                                                           | ⬜ needs sandbox `sk_test`/`pk_test` from user                                      |

Also open: **BUG-001** (storefront silently swallows the out-of-stock add-to-cart 409).
Non-payment note: `keen-cedar-6433.sparx.zone/shop` returns 500 (blank-tenant page
composition, orthogonal to payments) — worth a separate look.

---

## Diagnosis (confirmed via prod logs)

1. `createPaymentIntent()` opens the PaymentIntent + writes the `payment_intents` ledger
   row (status `requires_*`). No order/OrderPayment yet.
2. Shopper confirms the card **client-side** (`apps/site/components/checkout/payment-step.tsx`
   → `stripe.confirmPayment`). Charge succeeds → Stripe fires `payment_intent.succeeded`
   **immediately**.
3. `handleSucceeded` runs (logged at `1784888717910`). It sets the ledger row to
   `succeeded`, then looks up `OrderPayment` by `processorRef = pi_…` → **none exists yet**
   → (no booking/invoice) logs and returns:
   ```
   {"time":1784888717910,"chargeId":"pi_3TwgEFFY8gqB2fvj0yU3jJ90",
    "msg":"payment webhook: succeeded intent has no order or invoice"}
   ```
4. _Then_ the browser's `submitPayment` → `completeCheckout` → `complete()` creates the
   order + a **pending** `OrderPayment` (`processorRef = pi_…`) and back-links
   `paymentIntent.orderId`. Nothing re-flips it. Order stranded "Not paid" permanently.

Why it's common, not an edge case: the charge is confirmed **client-side**, so the webhook
races two additional browser→api round-trips (`submitPayment`, `completeCheckout`). Stripe
is fast; the browser isn't guaranteed to be. The webhook wins often.

**Compounding: Resend is a no-op.** `reconcilePaymentEvent` dedupes on the Stripe **event
id** — `recordEvent` inserts a `payment_events` row unique on `(gateway_id, external_id)`,
and the first delivery already recorded + `markProcessed`'d it even though it did nothing
useful. A resend carries the same `event.id` → `recordEvent` returns `false` (P2002) →
early return, no reconciliation. Verified live: resending `evt_3TwgEFFY8gqB2fvj0LfqpoeF`
returned 200 and `O-000001` stayed "Not paid."

The reconciler code itself is CORRECT — `normalizeStripeEvent` sets `chargeId = intent.id`
(the `pi_`) which matches `OrderPayment.processorRef`; the happy path (order exists first)
works. The defects are the timing race + the event-id gate.

---

## What was built (2026-07-24) — all three parts landed

All three parts are implemented in the working tree; `@sparx/commerce` + `@sparx/api-rest`
typecheck and lint clean. Summary of what shipped, then the original design notes.

- **Part A — real-time capture at checkout-complete (closes the race for the common case).**
  `complete()` now returns `paymentRef` + `paymentProviderSlug` for card orders. The public
  checkout-complete route ([routes/v1/public/checkout.ts](../../services/api-rest/src/routes/v1/public/checkout.ts)),
  right AFTER `complete()` commits, calls the new
  `reconcileCompletedCheckoutPayment(log, tenantId, gatewaySlug, paymentRef)` in
  [payment-webhook-reconcile.ts](../../services/api-rest/src/lib/payment-webhook-reconcile.ts).
  It re-reads the `payment_intents` ledger row; if already `succeeded` (webhook won the race),
  it finishes the capture by reusing `handleSucceeded` (idempotent — a no-op when the webhook
  captured normally). Post-commit so it sees the webhook's committed ledger write; best-effort
  (wrapped in try/catch — never blocks the placed order); skipped for held B2B orders.
- **Part B — webhook reconciliation is re-runnable (resend recovers).** `reconcilePaymentEvent`
  no longer early-returns on a duplicate `(gateway_id, external_id)` delivery. The
  `payment_events` row stays audit-only; the handler still runs. Every handler is
  effect-idempotent (status guards) and `handleSucceeded` only emits `order.paid`/email on the
  real pending→captured edge — so a Stripe **Resend** now finds the (by-then-existing) pending
  OrderPayment and completes the job, exactly as Brandon asked, with no double-email risk.
- **Part C — self-healing sweep (backstop for the residual race).** New
  `sweepStrandedCheckoutPayments(log, tenantId)` finds card OrderPayments still `pending` (older
  than a 2-min grace window) whose intent already `succeeded` and reconciles each idempotently.
  Wired to `POST /internal/commerce/payment-reconcile-sweep` in
  [commerce-cron.ts](../../services/api-rest/src/routes/internal/commerce-cron.ts) and a new
  `commerce-payment-reconcile-sweep` CronJob (`*/5 * * * *`) in `k8s/cronjobs/` (registered in
  the kustomization; deploys via `gh workflow run bootstrap.yml -f components=cronjobs`).

`handleSucceeded` now returns `'captured' | 'already' | 'none'` so the recovery path + sweep can
count real recoveries. No schema change. No new deps.

**To ship:** user commits + pushes → auto-tag → build-images → deploy-prod rolls api-rest + site;
then `gh workflow run bootstrap.yml -f components=cronjobs` for the sweep CronJob. Then re-run the
verification checklist below.

---

## Original fix design (for reference)

Three parts. Part A is the core; Part B makes resend a first-class recovery path (the
product decision); Part C is optional belt-and-suspenders.

**A. Close the race from the `complete()` side (proactive; most orders never need a webhook).**
In `checkoutService.complete()`, right after creating the pending `OrderPayment` +
back-linking the ledger (the `if (session.paymentRef && session.paymentProviderSlug)`
block): re-read the `payment_intents` row for `session.paymentRef`. If it is already
`succeeded` (the webhook beat us — it wrote that even when it found no OrderPayment), then
immediately mark the `OrderPayment` `captured` (+`capturedAt`) and the order
`paymentStatus: 'paid'` (+`paidAt`, `amountPaid`), and fire the same **post-commit** side
effects the webhook would (`order.paid`, confirmation email). Idempotent guard so it runs
once. Do the reconcile read/writes so they see the webhook's committed ledger update (do it
after `complete()`'s main txn commits, mirroring the existing post-commit event emits) to
avoid an in-transaction visibility race.

**B. Make webhook reconciliation re-runnable so a Resend recovers a stranded order.**
(This is what Brandon asked for.) Stop gating side effects on the event-id dedupe. Keep the
`payment_events` row for **audit/observability**, but on a duplicate delivery do NOT
early-return — still run the idempotent handler. The handlers are already effect-idempotent:
`handleSucceeded` returns `{kind:'already'}` (and does NOT re-emit `order.paid`/email) when
the `OrderPayment` is already `captured`, and only emits on the actual pending→captured
transition; `handleFailed`/`handleRefunded` have their own status guards. So re-processing a
redelivery is safe and, crucially, a resend AFTER the order exists will find the pending
`OrderPayment` and complete the job. Net: dedupe row = audit; reconciliation = always runs;
side effects = guarded by real status. (Alternative if you'd rather keep a gate: only mark
an event `processedAt` when it actually reconciled a target — i.e. the `none` outcome must
NOT be recorded as processed when the intent carries a `sparx_checkout_session_id`, so the
row stays "unfinished" and a resend re-runs. Effect-idempotent reprocessing is simpler and
strictly more robust — prefer it.)

**C. (Optional) Safety-net sweep.** A periodic/one-shot job that finds any `OrderPayment`
still `pending` whose `payment_intents` row (`external_id = processorRef`) is `succeeded`
and reconciles it (idempotent). With B in place this is redundant for recovery (resend
works), but it's a cheap backstop for silent stragglers and self-heals without human action.

Verification after the fix (do all three):

1. Fresh checkout where the webhook wins the race → order still ends up `paid` (Part A).
2. Force a stranded order (or reuse `O-000001`), Resend the event → order flips to `paid`
   (Part B). Confirm `order.paid` fires + confirmation email sends, exactly once.
3. Double-deliver / resend a paid order → no double email, no double `order.paid`, refund
   totals unaffected (idempotency).

---

## Recover `O-000001` (the already-stranded order)

Its `payment_intents` ledger row is already `succeeded`. Once Part B ships, **Resend the
event** in the Stripe dashboard → it will mark paid. Until then it stays "Not paid" (fine
for testing). Do NOT hand-edit the DB.

---

## Thoughts / recommendations

- This is the #1 pre-launch path and the ONLY thing standing between "sandbox-proven" and a
  trustworthy go-live. Everything else (onboarding, charge, destination transfer, fee,
  order creation, webhook delivery) is confirmed working end-to-end in production.
- Prefer **A + B together**: A stops the bleeding for the common case (no webhook round-trip
  needed); B turns the webhook into a reliable recovery/backfill path, which is the behavior
  Brandon wants and which a real payments platform should have anyway. C is nice-to-have.
- The fix is small and contained (one block in `complete()`, one guard change in
  `reconcilePaymentEvent`) — file changes + typecheck/lint, then deploy, then re-run the
  charge to watch an order self-mark paid. No schema change required.
- **Testing gotcha to remember (cost us ~an hour):** Stripe Connect hosted onboarding
  **blocks headless browsers** at the identity step — it returns `login_failure` /
  `captcha_try_again_later_support_error` and the UI shows "User not found" even with a
  solved hCaptcha. It is NOT a sparx bug and NOT something a real merchant hits. Complete
  Connect onboarding in a **real, visible Chrome** (we used the claude-in-chrome extension).
  Everything else — checkout, Elements, charge — works fine headless.
