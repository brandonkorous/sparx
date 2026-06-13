// @sparx/billing — platform billing (WizeWorks charges tenants per active module
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
  syncModuleItems,
  createPortalSession,
  getBillingState,
  reconcileFromSubscription,
  setSubscriptionStatus,
  moduleForPriceId,
  type SubscriptionSyncInput,
  type BillingResult,
} from './service';
