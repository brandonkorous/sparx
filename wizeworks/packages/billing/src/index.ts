// @wizeworks/billing — platform billing: the subscription WizeWorks charges a tenant
// for, out of the Stripe account its PLAN names.
//
// ./plans is the registry — a plan says how the bill is shaped (`per_module`, one
// item per active module; `flat`, one base item plus capacity) and which Stripe
// account it bills from. Nothing here ever asks which BRAND a tenant is; it reads
// `tenants.billing_plan` and looks the plan up. See ./service for the engine and
// ./price-catalog for the module prices + transaction-fee math. Every Stripe call is
// guarded by isBillingConfigured(plan), so the package is a safe no-op until a given
// account's ops land (docs/67).

export {
  MODULE_MONTHLY_CENTS,
  TRIAL_PERIOD_DAYS,
  isBillableModule,
  priceIdFor,
  activeTotalCents,
  type BillingInterval,
} from './price-catalog';

export {
  getBillingStripe,
  isBillingConfigured,
  anyBillingConfigured,
  resetBillingStripeForTesting,
} from './client';

export {
  DEFAULT_PLAN_ID,
  planFor,
  listBillingPlans,
  capacityBlockFor,
  registerBillingPlan,
  resetBillingPlansForTesting,
  type BillingPlan,
  type CapacityBlock,
  type PlanShape,
} from './plans';

export {
  resolveBillingPhase,
  isPlatformTenant,
  GRACE_PERIOD_DAYS,
  type BillingPhase,
  type BillingPhaseInput,
  type BillingPhaseView,
} from './gate';

export {
  syncModuleItems,
  createPortalSession,
  createCheckoutSession,
  getBillingState,
  reconcileFromSubscription,
  setSubscriptionStatus,
  moduleForPriceId,
  type SubscriptionSyncInput,
  type BillingResult,
  type CheckoutSessionResult,
} from './service';

export {
  listPlatformStripeEvents,
  listTenantCharges,
  listPlatformCoupons,
  listPromotionCodes,
  refundCharge,
  createPlatformCoupon,
  deletePlatformCoupon,
  createPromotionCode,
  deactivatePromotionCode,
  createEnterpriseInvoice,
  type PlatformStripeEvent,
  type PlatformCharge,
  type PlatformCoupon,
  type PlatformPromotionCode,
  type RefundReason,
  type RefundInput,
  type RefundResult,
  type CreateCouponInput,
  type CreatePromotionCodeInput,
  type EnterpriseInvoiceLine,
  type CreateInvoiceInput,
  type InvoiceResult,
} from './operator';
