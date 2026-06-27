# sparx Platform — Multi-Gateway Payments (bring-your-own + custom)

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-06-27

> Extends [94-ADR-payment-gateway.md](94-ADR-payment-gateway.md). 94 defined the vendor-agnostic
> `PaymentGateway` abstraction, the registry, `PaymentService`, the credential seam, and the first two
> gateways (sparx Pay = Connect destination charges; Stripe Direct = the merchant's own account). This
> doc adds the rest of the door: **bring-your-own gateways** (Square, Authorize.net, 1stPayGateway) and a
> **custom** path (generic hosted-redirect + a developer plugin seam). Read 94 first — this does not
> re-define the interface, it fills its empty slots.

---

## 0. Why

sparx Pay is the frictionless default and the lever for better blended rates as volume grows. But an
established business already running on Square, Authorize.net, 1stPayGateway — or anything else — will
not switch platforms if it means ripping out their processor. **The processor must never be the reason a
tenant walks.** So every tenant can bring their own gateway, and a custom path covers the long tail.

This is consolidation-friendly with the Finance hub (docs/109/110): all of this lives behind the one
**Finance → Payments** door. Adding a vendor is a catalog descriptor + an adapter — never a new surface.

---

## 1. Binding decisions

- **D1 — The gateway list is a data-driven catalog.** A single `GATEWAY_CATALOG` (data-as-code in
  `@sparx/payments`) declares every gateway: id, display copy, **onboarding style**, **credential
  schema**, **capabilities**, **checkout style**, regions, fee note. One source feeds the dashboard UI,
  server-side validation, and the adapters. Adding a gateway = a descriptor + a `PaymentGateway` adapter.
  No new UI branches, no new routes.

- **D2 — Merchant-supplied credentials are encrypted in the DB, not Secret Manager.** The payment secret
  reader (94 §5) is **read-only** by design — platform secrets (sparx Pay, Stripe Direct) are provisioned
  out-of-band into GSM, the app SA only has accessor. Merchant-entered keys (Square/Authorize.net/1stPay/
  custom) instead follow the **established merchant-secret pattern**: AES-256-GCM envelope encryption via
  `@sparx/channels/crypto` (the same box sparx.market bank numbers and channel OAuth tokens use), stored
  as ciphertext in a new `tenant_gateway_credentials` table. No IAM/Terraform change; a DB leak alone
  yields no usable key. The adapters read+decrypt at runtime through a small reader that knows both
  sources (GSM ref → platform gateways; encrypted row → merchant gateways).

- **D3 — Onboarding styles.** Each catalog entry declares one:
  - `sparx_hosted` — Stripe Connect Express (sparx Pay). Hosted onboarding; nothing to capture.
  - `api_keys` — the merchant pastes keys from their processor dashboard (Authorize.net: API login id +
    transaction key + public client key; Square: application id + access token + location id; 1stPay:
    gateway id + API key + auth key). Captured, validated against the schema, encrypted (D2).
  - `manual` — no online processing (record payments by hand). Already exists.

- **D4 — Checkout style: inline for Stripe-family, hosted-redirect for the rest.** The storefront payment
  step is Stripe-Elements-inline today. Rather than embed three more JS SDKs (and own their PCI surface),
  every non-Stripe gateway processes through its **vendor-hosted payment page** (Square Checkout,
  Authorize.net Accept Hosted, 1stPay hosted, or the custom processor's own page). The card form is the
  vendor's, so sparx stays at **SAQ-A** — raw PANs never touch sparx. The checkout branches on the
  catalog's `checkout` field: `inline` (Stripe family) renders Elements; `redirect` sends the shopper to
  the hosted page and resumes on return. The `PaymentGateway.createPaymentLink` seam (94 §3) already
  models exactly this.

- **D5 — Webhooks normalize to a vendor-neutral shape.** 94's `ParsedWebhookEvent` normalized the event
  TYPE but left `payload: unknown`, and the reconciler reads Stripe object fields directly. This doc adds
  a **normalized `PaymentEventData`** (`externalId`, `amountCents`, `currency`, `chargeId`, `tenantId`,
  `orderId`/`invoiceId`/`bookingId` from metadata, `refundId`, `refundedCents`) that every adapter's
  `parseWebhook` fills. The reconciler consumes that shape, not `Stripe.PaymentIntent` — so a Square or
  Authorize.net event reconciles through the same path. Stripe adapters keep their raw payload too (for
  the audit log) but the reconciler stops depending on it.

- **D6 — Custom = hosted-redirect + plugin (your pick).** Two paths, neither a stub:
  - **Generic hosted-redirect adapter** (`custom`): the tenant configures their processor's hosted
    checkout URL + return/webhook handling + credentials. sparx redirects out and reconciles on
    return/webhook. Works with almost any processor, no per-vendor code, SAQ-A.
  - **Plugin seam**: the `PaymentGateway` interface IS the extension point. A developer/agency drops a
    code adapter into `@sparx/payments/gateways/*` (or registers one at boot via
    `gatewayRegistry.register`) and adds a `GATEWAY_CATALOG` descriptor — it lights up across checkout,
    invoices, and B2B with zero flow changes. Documented as the contract here.

- **D7 — sparx Pay stays the default + the pitch.** The catalog marks sparx Pay `recommended`; the UI
  leads with it (frictionless, sparx owns disputes/PCI/settlement, flat 0.5%, better rates at scale).
  Bring-your-own is always one tab away — present, never pushed.

---

## 2. Data model

New table (`packages/db/prisma/schema/74-payments.prisma`), FORCE-RLS like its siblings:

```
model TenantGatewayCredential {
  id          uuid pk
  tenantId    uuid            // FK tenant, RLS
  gatewayId   varchar(50)     // 'square' | 'authorize_net' | 'first_pay' | 'custom' | …
  environment varchar(20)     // 'sandbox' | 'production'
  // AES-256-GCM ciphertext of the JSON credential object (iv.tag.cipher base64) — never plaintext.
  secretEnc   text
  // Non-secret display fields kept in the clear (last4 of an account id, the public client key, etc.)
  publicMeta  jsonb           // e.g. { locationId, clientKey, hostedUrl } — safe to render
  status      varchar(20)     // 'unverified' | 'active' | 'disabled'
  @@unique([tenantId, gatewayId])
}
```

`tenant_payment_configs.gatewayId` continues to name the ACTIVE gateway (unchanged). The credential row
holds the keys for whichever gateways the tenant has configured, so switching gateways doesn't require
re-entry. RLS + hand-edited SQL per [packages/db/CLAUDE.md](../packages/db/CLAUDE.md).

---

## 3. Slices (build order — each a deployable commit)

0. **ADR** — this doc. ✅
1. **Catalog** ✅ — `GATEWAY_CATALOG` descriptors + credential-field schemas for every gateway
   (`packages/payments/src/catalog.ts`).
2. **Credential model** ✅ — `tenant_gateway_credentials` (migration `20260922000000_gateway_credentials`),
   `@sparx/channels/crypto` envelope, the injected `GatewayCredentialReader` seam
   (`packages/payments/src/credentials.ts`) wired in `payments-bootstrap` to read+decrypt the row.
3. **Webhook normalization** ✅ — `NormalizedPaymentData` on `ParsedWebhookEvent`; the reconciler reads
   that shape (no `Stripe.PaymentIntent` on the payment path); the Stripe normalizer fills it.
4. **Adapters** ✅ — Square, Authorize.net, 1stPayGateway — REST + `fetch` (no SDKs), hosted-redirect
   checkout, refunds, webhook parse → normalized (`packages/payments/src/gateways/*`).
5. **Custom** ✅ — generic hosted-redirect adapter + the plugin contract (`registerSparxGateways` doc).
6. **Backend** ✅ — `selectGateway` is catalog-aware (manual → active, api-key → active on capture);
   credential capture/list/delete endpoints (`/v1/commerce/payments/credentials`) + the catalog endpoint;
   credentials encrypted via `gateway-credentials.ts`; all gateways registered at boot.
7. **Dashboard UI** ✅ — Finance → Payments rendered from the catalog: a card per gateway + a credential
   form generated from each schema (`gateway-credential-form.tsx`). sparx Pay leads.
8. **Storefront checkout** ✅ — the intent contract carries `redirectUrl` end-to-end (checkout-service →
   public route → checkout-client); `PaymentStep` branches `inline` (Elements) vs `redirect` (hosted
   handoff; GET, or token form-POST for Authorize.net Accept Hosted).

**Remaining (go-live, §4):** the per-vendor inbound **webhook routes** (each resolves the tenant from its
path then calls the adapter's `parseWebhookForTenant` → `reconcilePaymentEvent`) and the hosted-return
**order-completion** flow are wired against the adapters but exercised per-vendor with sandbox credentials.

---

## 4. Go-live (the trailing strand, per 94 §13 + docs/92 precedent)

Each gateway is exercised end-to-end only against its **vendor sandbox credentials** (Square sandbox,
Authorize.net sandbox, 1stPay test center): connect → hosted-pay → webhook → reconcile → refund. The
code ships first (deploy-early); lighting up a specific vendor is a per-vendor go-live, not a blocker for
the framework. `CHANNELS_TOKEN_KEY` (already provisioned for channels/market) is the envelope key — no new
secret to mint for the credential box.

---

## 5. Non-goals

- **No raw-PAN handling.** Every path is vendor-hosted or vendor-tokenized; sparx never receives a card
  number. No SAQ-D scope, ever.
- **No per-gateway settlement/payout modeling.** Bring-your-own means the merchant owns their money flow
  end-to-end at their processor; sparx takes no fee and does not settle it (mirrors Stripe Direct). Only
  sparx Pay and sparx.market have sparx-side payout surfaces (Finance → Payouts).
- **No automatic gateway migration.** Switching gateways changes the active processor going forward;
  in-flight intents settle on whichever gateway created them.
