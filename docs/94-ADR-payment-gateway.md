# ADR — Payment Gateway Architecture & Sparx Pay

**For:** Claude Code / build agent
**Date:** 2026-06-12
**Status:** Decided — do not relitigate.
**Context:** Zero users in production. Build the full gateway abstraction
now. Use Stripe Connect as the Sparx Pay implementation.

---

## 1. The Decision

Sparx does not build its own payment processing. Stripe Connect (destination
charges) is the Sparx Pay implementation. A `PaymentGateway` interface
abstracts all payment vendors so the checkout, invoicing, and B2B payment
flows never know which vendor is processing.

Do not build money transmission infrastructure. Do not pursue PCI DSS
Level 1 compliance for owned payment rails. Revisit in years when GMV
volume makes Stripe's economics a material margin issue. That is not now.

---

## 2. Sparx Pay — What It Is

Sparx Pay is a Sparx-branded product powered by Stripe Connect destination
charges. Merchants see "Sparx Pay." They do not see Stripe unless they
look at their bank statement. The branding is Sparx. The infrastructure
is Stripe.

**Why destination charges (not direct charges):**

Destination charges create the charge on Sparx's platform Stripe account
with `on_behalf_of` + `transfer_data.destination` → the merchant's
connected account. `application_fee_amount` collects the Sparx platform
fee automatically before the remainder transfers to the merchant.

This means:
- Sparx owns the charge and dispute surface
- Sparx controls dispute responses — merchants don't handle Stripe disputes
- Platform fee collection is automatic — no invoicing merchants for fees
- PCI compliance surface is Sparx's responsibility, not the merchant's
- Merchants don't need to understand Stripe beyond Connect onboarding

Direct charges would put all of the above on the merchant. That contradicts
the "Sparx handles the complexity" pitch. Destination charges is correct.

---

## 3. The Gateway Interface

Build this interface now. Every payment flow in the platform — storefront
checkout, invoice payment links, B2B order payments — calls this interface.
None of them know or care which vendor is behind it.

```typescript
// packages/payments/src/gateway.ts

export interface PaymentIntent {
  id:           string
  clientSecret: string    // for client-side confirmation
  amount:       number    // in cents
  currency:     string
  status:       PaymentIntentStatus
  metadata:     Record<string, string>
}

export type PaymentIntentStatus =
  | 'requires_payment_method'
  | 'requires_confirmation'
  | 'requires_action'
  | 'processing'
  | 'succeeded'
  | 'canceled'

export interface PaymentResult {
  success:      boolean
  chargeId?:    string
  errorCode?:   string
  errorMessage?: string
}

export interface RefundResult {
  success:      boolean
  refundId?:    string
  amount:       number
  errorMessage?: string
}

export interface WebhookEvent {
  type:         string
  payload:      unknown
  rawBody:      Buffer
  signature:    string
}

export interface PaymentGateway {
  readonly id:   string   // 'sparx_pay' | 'stripe_direct' | 'paypal' |
                          // 'square' | 'authorize_net' | 'custom'
  readonly name: string   // Display name shown in dashboard

  // Core payment operations
  createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntent>
  confirmPayment(intentId: string): Promise<PaymentResult>
  capturePayment(intentId: string, amount?: number): Promise<PaymentResult>
  cancelPayment(intentId: string): Promise<PaymentResult>
  refund(params: RefundParams): Promise<RefundResult>

  // Invoice-specific — generate a hosted payment link
  // Returns null if gateway does not support hosted payment links
  createPaymentLink(params: CreatePaymentLinkParams): Promise<string | null>

  // Webhook handling
  parseWebhook(event: WebhookEvent): Promise<ParsedWebhookEvent>
  verifyWebhookSignature(body: Buffer, signature: string): boolean
}

export interface CreatePaymentIntentParams {
  tenantId:        string
  amount:          number          // cents
  currency:        string          // 'usd'
  orderId?:        string
  invoiceId?:      string
  customerId?:     string
  metadata?:       Record<string, string>
  captureMethod?:  'automatic' | 'manual'
}

export interface RefundParams {
  tenantId:        string
  chargeId:        string
  amount?:         number          // partial refund if specified
  reason?:         'duplicate' | 'fraudulent' | 'requested_by_customer'
  metadata?:       Record<string, string>
}

export interface CreatePaymentLinkParams {
  tenantId:        string
  amount:          number
  currency:        string
  invoiceId:       string
  description:     string
  expiresAt?:      Date
  successUrl:      string
}

export interface ParsedWebhookEvent {
  type:            'payment.succeeded' | 'payment.failed' |
                   'payment.refunded' | 'dispute.created' |
                   'dispute.closed' | 'account.updated'
  tenantId?:       string
  payload:         unknown
}
```

---

## 4. Gateway Registry

```typescript
// packages/payments/src/registry.ts

class GatewayRegistry {
  private gateways = new Map<string, PaymentGateway>()

  register(gateway: PaymentGateway): void {
    this.gateways.set(gateway.id, gateway)
  }

  get(gatewayId: string): PaymentGateway {
    const gateway = this.gateways.get(gatewayId)
    if (!gateway) throw new Error(`Payment gateway not found: ${gatewayId}`)
    return gateway
  }

  list(): PaymentGateway[] {
    return Array.from(this.gateways.values())
  }
}

export const gatewayRegistry = new GatewayRegistry()

// Registration at startup
import { SparxPayGateway }     from './gateways/sparx-pay'
import { StripeDirectGateway } from './gateways/stripe-direct'

gatewayRegistry.register(new SparxPayGateway())
gatewayRegistry.register(new StripeDirectGateway())
// Future: PayPalGateway, SquareGateway, etc.
```

---

## 5. Tenant Payment Configuration

Each tenant configures which gateway they use. Stored in the tenant's
settings. Resolved by the payment service on every transaction.

```typescript
// Tenant payment config — stored in DB
interface TenantPaymentConfig {
  tenantId:         string
  gatewayId:        string    // 'sparx_pay' | 'stripe_direct' | etc.
  sparxPayEnabled:  boolean   // true if gatewayId = 'sparx_pay'

  // Gateway-specific credentials — stored in Secret Manager
  // Never in the DB directly
  credentialsRef:   string    // Secret Manager reference key
}

// Secret Manager key pattern per gateway:
// payments/{tenantId}/sparx_pay/stripe_account_id
// payments/{tenantId}/stripe_direct/secret_key
// payments/{tenantId}/paypal/client_id
// payments/{tenantId}/paypal/client_secret
```

Payment service resolves the gateway at transaction time:

```typescript
// packages/payments/src/payment.service.ts

export class PaymentService {
  async getGatewayForTenant(tenantId: string): Promise<PaymentGateway> {
    const config = await db.tenantPaymentConfig.findUnique({
      where: { tenantId }
    })
    if (!config) throw new Error(`No payment config for tenant ${tenantId}`)
    return gatewayRegistry.get(config.gatewayId)
  }

  async createPaymentIntent(params: CreatePaymentIntentParams) {
    const gateway = await this.getGatewayForTenant(params.tenantId)
    const intent  = await gateway.createPaymentIntent(params)

    // Apply platform fee only if Sparx Pay
    // (fee collection happens in Stripe via application_fee_amount —
    //  this is informational for our records)
    const platformFee = gateway.id === 'sparx_pay'
      ? Math.round(params.amount * 0.005)  // 0.5%
      : 0

    await db.paymentIntent.create({
      data: {
        tenantId:       params.tenantId,
        gatewayId:      gateway.id,
        externalId:     intent.id,
        amount:         params.amount,
        platformFee,
        orderId:        params.orderId,
        invoiceId:      params.invoiceId,
        status:         'pending',
      }
    })

    return intent
  }
}
```

---

## 6. Sparx Pay Implementation (Stripe Connect Destination Charges)

```typescript
// packages/payments/src/gateways/sparx-pay.ts

import Stripe from 'stripe'

export class SparxPayGateway implements PaymentGateway {
  readonly id   = 'sparx_pay'
  readonly name = 'Sparx Pay'

  private platform: Stripe

  constructor() {
    this.platform = new Stripe(process.env.STRIPE_PLATFORM_SECRET_KEY!, {
      apiVersion: '2024-06-20',
    })
  }

  async createPaymentIntent(params: CreatePaymentIntentParams) {
    const merchantAccountId = await this.getMerchantAccountId(params.tenantId)
    const platformFee = Math.round(params.amount * 0.005)  // 0.5%

    const intent = await this.platform.paymentIntents.create({
      amount:          params.amount,
      currency:        params.currency,
      on_behalf_of:    merchantAccountId,
      transfer_data: {
        destination:   merchantAccountId,
      },
      application_fee_amount: platformFee,
      metadata: {
        tenantId:    params.tenantId,
        orderId:     params.orderId    ?? '',
        invoiceId:   params.invoiceId  ?? '',
        customerId:  params.customerId ?? '',
        ...params.metadata,
      },
    })

    return {
      id:           intent.id,
      clientSecret: intent.client_secret!,
      amount:       intent.amount,
      currency:     intent.currency,
      status:       intent.status as PaymentIntentStatus,
      metadata:     intent.metadata as Record<string, string>,
    }
  }

  async createPaymentLink(params: CreatePaymentLinkParams): Promise<string> {
    const merchantAccountId = await this.getMerchantAccountId(params.tenantId)
    const platformFee = Math.round(params.amount * 0.005)

    const session = await this.platform.checkout.sessions.create({
      mode:                'payment',
      on_behalf_of:        merchantAccountId,
      application_fee_amount: platformFee,
      transfer_data: {
        destination:       merchantAccountId,
      },
      line_items: [{
        price_data: {
          currency:     params.currency,
          unit_amount:  params.amount,
          product_data: { name: params.description },
        },
        quantity: 1,
      }],
      success_url:   params.successUrl,
      expires_at:    params.expiresAt
        ? Math.floor(params.expiresAt.getTime() / 1000)
        : undefined,
      metadata: {
        tenantId:  params.tenantId,
        invoiceId: params.invoiceId,
      },
    })

    return session.url!
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    try {
      const refund = await this.platform.refunds.create({
        charge:   params.chargeId,
        amount:   params.amount,
        reason:   params.reason,
        metadata: params.metadata ?? {},
      })
      return {
        success:  true,
        refundId: refund.id,
        amount:   refund.amount,
      }
    } catch (err: any) {
      return {
        success:      false,
        amount:       params.amount ?? 0,
        errorMessage: err.message,
      }
    }
  }

  verifyWebhookSignature(body: Buffer, signature: string): boolean {
    try {
      this.platform.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_PLATFORM_WEBHOOK_SECRET!
      )
      return true
    } catch {
      return false
    }
  }

  private async getMerchantAccountId(tenantId: string): Promise<string> {
    const creds = await secretManager.get(
      `payments/${tenantId}/sparx_pay/stripe_account_id`
    )
    if (!creds) throw new Error(`No Sparx Pay account for tenant ${tenantId}`)
    return creds
  }
}
```

---

## 7. Stripe Direct Implementation (Merchant's Own Stripe Account)

For merchants who want to use their own Stripe account directly.
Sparx is not in the payment flow. No platform fee collected.

```typescript
// packages/payments/src/gateways/stripe-direct.ts

export class StripeDirectGateway implements PaymentGateway {
  readonly id   = 'stripe_direct'
  readonly name = 'Stripe (your account)'

  async createPaymentIntent(params: CreatePaymentIntentParams) {
    const stripe = await this.getStripeForTenant(params.tenantId)

    const intent = await stripe.paymentIntents.create({
      amount:   params.amount,
      currency: params.currency,
      // No on_behalf_of — this IS the merchant's account
      // No application_fee_amount — Sparx takes no fee
      metadata: {
        tenantId:   params.tenantId,
        orderId:    params.orderId   ?? '',
        invoiceId:  params.invoiceId ?? '',
        ...params.metadata,
      },
    })

    return {
      id:           intent.id,
      clientSecret: intent.client_secret!,
      amount:       intent.amount,
      currency:     intent.currency,
      status:       intent.status as PaymentIntentStatus,
      metadata:     intent.metadata as Record<string, string>,
    }
  }

  async createPaymentLink(params: CreatePaymentLinkParams): Promise<string> {
    const stripe = await this.getStripeForTenant(params.tenantId)

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency:     params.currency,
          unit_amount:  params.amount,
          product_data: { name: params.description },
        },
        quantity: 1,
      }],
      success_url: params.successUrl,
      metadata: {
        tenantId:  params.tenantId,
        invoiceId: params.invoiceId,
      },
    })

    return session.url!
  }

  private async getStripeForTenant(tenantId: string): Promise<Stripe> {
    const secretKey = await secretManager.get(
      `payments/${tenantId}/stripe_direct/secret_key`
    )
    if (!secretKey) throw new Error(`No Stripe Direct config for tenant ${tenantId}`)
    return new Stripe(secretKey, { apiVersion: '2024-06-20' })
  }
}
```

---

## 8. Transaction Fee Rules

```
Sparx Pay (destination charges):
  Platform fee: 0.5% on every payment processed
  Collected:    automatically via application_fee_amount
  Applied to:   storefront checkout, invoice payment links,
                B2B order payments, any Sparx Pay transaction

Any other gateway (stripe_direct, paypal, square, etc.):
  Platform fee: $0
  Reason:       Sparx is not in the payment flow.
                There is no mechanism to collect a fee and
                no justification for one — Sparx provided
                no payment infrastructure.

Manual payments (check, cash, wire, ACH direct):
  Platform fee: $0
  Reason:       Sparx never touched the money.
                Merchant marks invoice as paid manually.
```

No tier-based fee structure. No plan-based fee structure. One rule:
Sparx Pay = 0.5% fee. Everything else = no fee. Simple, honest,
and consistent with the modules-not-plans philosophy.

**Invoicing specifically:**

Invoice paid via Sparx Pay payment link → 0.5% fee applies.
Invoice paid manually (check, wire, ACH) → no fee.
Merchant controls which path by whether they include a payment link.

---

## 9. Sparx Pay Onboarding (Connect Onboarding)

During merchant onboarding, after module activation:

```
Step: Connect Sparx Pay

Option A: Use Sparx Pay (recommended)
  → Stripe Connect Express onboarding
  → Merchant provides: business name, bank account, SSN/EIN
  → Sparx handles: disputes, PCI compliance surface,
    fee collection, settlement
  → Takes ~5 minutes

Option B: Use your own payment processor
  → Select from: Stripe (your account), PayPal, Square, Other
  → Merchant provides their own API credentials
  → Merchant handles: disputes, PCI compliance, everything
  → Sparx routes checkout to their gateway

Option C: Skip for now
  → Store can be built but not take payments
  → Can configure payment processor later from Settings → Payments
```

Connect Express (not Custom or Standard) is the right Stripe Connect
tier for Sparx Pay:
- Express: Stripe hosts the onboarding UI, Sparx has moderate control
- Custom: Sparx builds the entire onboarding UI, maximum control
- Standard: merchant manages their own full Stripe account

Express is correct for now. The onboarding is fast, Stripe handles KYC,
and Sparx has enough control for the destination charges model.
Move to Custom connect only if Express's limitations become a real
constraint — that is a future decision.

---

## 10. Webhook Routing

Each gateway has its own webhook endpoint. Webhooks are routed to the
correct gateway handler by the registry.

```
POST /webhooks/sparx-pay        → SparxPayGateway.parseWebhook()
POST /webhooks/stripe-direct    → StripeDirectGateway.parseWebhook()
POST /webhooks/paypal           → PayPalGateway.parseWebhook() (future)
```

All parsed webhook events normalize to the same internal event type
(`payment.succeeded`, `payment.failed`, `dispute.created`, etc.) and
publish to Pub/Sub. The commerce and invoicing modules subscribe to
these normalized events — they never parse raw gateway webhooks.

```
Raw Stripe webhook → SparxPayGateway.parseWebhook()
  → normalized PaymentWebhookEvent
  → Pub/Sub: payment.succeeded { tenantId, orderId, amount }
  → Commerce order service marks order paid
  → Invoicing service marks invoice paid
  → Automation engine triggers billing_document.paid
```

---

## 11. Database Schema

```sql
CREATE TABLE tenant_payment_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL UNIQUE REFERENCES tenants(id),
  gateway_id      VARCHAR(50) NOT NULL DEFAULT 'sparx_pay',
  -- 'sparx_pay' | 'stripe_direct' | 'paypal' | 'square' | 'custom'
  is_active       BOOLEAN NOT NULL DEFAULT false,
  -- false until onboarding is complete
  credentials_ref VARCHAR(255),
  -- Secret Manager key: payments/{tenantId}/{gateway_id}/...
  onboarded_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payment_intents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  gateway_id      VARCHAR(50) NOT NULL,
  external_id     VARCHAR(255) NOT NULL,  -- gateway's own intent ID
  amount          INTEGER NOT NULL,        -- cents
  currency        CHAR(3) NOT NULL DEFAULT 'usd',
  platform_fee    INTEGER NOT NULL DEFAULT 0,  -- cents, 0 if not Sparx Pay
  status          VARCHAR(50) NOT NULL DEFAULT 'pending',
  order_id        UUID REFERENCES orders(id),
  billing_doc_id  UUID REFERENCES billing_documents(id),
  customer_id     UUID REFERENCES customers(id),
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payment_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  gateway_id      VARCHAR(50) NOT NULL,
  external_id     VARCHAR(255) NOT NULL,  -- gateway's event ID
  event_type      VARCHAR(100) NOT NULL,  -- normalized event type
  payload         JSONB NOT NULL,
  processed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 12. What NOT to Build

Do not build any of the following. These are future decisions.

```
❌ Own payment processing / money transmission
   Requires: state money transmission licenses (47 states),
   PCI DSS Level 1 compliance, banking relationships,
   fraud tooling, 12-18 months, significant capital.
   Revisit when Sparx Pay GMV volume makes Stripe's
   per-transaction economics a material margin issue.
   That is not now.

❌ PayPal gateway implementation (yet)
   Build the interface now, implement when a merchant asks for it.

❌ Square gateway implementation (yet)
   Same — implement on merchant demand.

❌ Stripe Custom Connect
   Express is sufficient. Move to Custom only if Express's
   limitations become a real constraint. Document the specific
   constraint before making the change.

❌ Split payments / multi-merchant cart checkout
   sparx.market Phase 2 feature. Not needed for single-merchant
   checkout which is Phase 1.
```

---

## 13. Definition of Done

```
✅ PaymentGateway interface defined in packages/payments
✅ GatewayRegistry implemented and exported
✅ SparxPayGateway implemented (Stripe Connect destination charges)
✅ StripeDirectGateway implemented (merchant's own Stripe account)
✅ tenant_payment_configs table + migrations
✅ payment_intents table + migrations
✅ payment_events table + migrations
✅ PaymentService resolves gateway from tenant config
✅ Platform fee (0.5%) applied only when gateway = 'sparx_pay'
✅ Platform fee $0 on all other gateways — enforced, not optional
✅ Webhook endpoints per gateway (/webhooks/sparx-pay, etc.)
✅ Webhook events normalized and published to Pub/Sub
✅ Storefront checkout uses PaymentService (not Stripe directly)
✅ Invoice payment link creation uses PaymentService
✅ B2B order payment uses PaymentService
✅ Sparx Pay Connect Express onboarding flow in dashboard
✅ Settings → Payments shows active gateway + onboarding status
✅ Manual payment recording does not create a PaymentIntent
   (no gateway involved, no fee, merchant marks paid manually)
```
