// @wizeworks/billing — platform billing (WizeWorks charges tenants per active module
// via one Stripe subscription, one item per module). See ./service for the engine
// and ./price-catalog for the prices + transaction-fee math. Every Stripe call is
// guarded by isBillingConfigured(), so the package is a safe no-op until the prod
// Stripe ops land (docs/67).

export {
  MODULE_MONTHLY_CENTS,
  TRIAL_PERIOD_DAYS,
  isBillableModule,
  priceIdFor,
  activeTotalCents,
  type BillingInterval,
} from './price-catalog';

export { getBillingStripe, isBillingConfigured, resetBillingStripeForTesting } from './client';

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
