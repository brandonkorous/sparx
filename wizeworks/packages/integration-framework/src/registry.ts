// Provider registry. Concrete provider packages register their bundle at
// boot; the providerService.listAvailable() call reads from this registry
// to render the marketplace catalog.

import type { ProviderKind } from '@wizeworks/commerce-schemas';

import type { DropshipProvider } from './dropship-provider';
import type { ProviderMetadataDescriptor } from './metadata';
import type { ShippingProvider } from './shipping-provider';
import type { TaxProvider } from './tax-provider';

/**
 * A provider bundle — a single npm package may implement several kinds. The fields
 * below are the per-kind entry points; absent means "this bundle does not implement
 * that kind."
 *
 * THERE IS NO `payment` OR `subscriptionBilling` SLOT, and that is deliberate.
 *
 * There used to be both, alongside full `PaymentProvider` and `SubscriptionBilling`
 * contracts and a doc comment promising "provider-stripe implements PaymentProvider +
 * SubscriptionBilling + TaxProvider". No such package ever existed. Nothing in the
 * platform dispatched either contract. `PaymentProvider`'s only implementer was a
 * PayPal stub whose every method threw; `SubscriptionBilling` had none at all, while
 * two other files described recurring charges as "backed by a SubscriptionBilling
 * provider" that subscription-service never called.
 *
 * Real payments have always run through `@wizeworks/payments`' gateway registry — so
 * payments were modelled twice, and the dead copy was the one that looked official
 * enough to make a working Stripe integration read as missing.
 *
 * Payments belong to `@wizeworks/payments`. A new processor is a `GATEWAY_CATALOG`
 * descriptor plus a `PaymentGateway` adapter; if it is not written yet the descriptor
 * carries `availability: 'coming_soon'` and no stub is needed at all. Recurring
 * billing, when it is built, belongs there too — beside the code that already charges
 * cards, not in a second framework that has never charged one.
 *
 * The general rule, which is what keeps this happening to the next kind: a kind
 * belongs in this bundle ONLY if this framework actually dispatches it. Today that is
 * shipping, tax and dropship.
 */
export interface ProviderBundle {
  metadata: ProviderMetadataDescriptor;
  tax?: TaxProvider;
  shipping?: ShippingProvider;
  dropship?: DropshipProvider;
}

class Registry {
  private readonly bySlug = new Map<string, ProviderBundle>();

  register(bundle: ProviderBundle): void {
    if (this.bySlug.has(bundle.metadata.slug)) {
      throw new Error(`Provider already registered: ${bundle.metadata.slug}`);
    }
    this.bySlug.set(bundle.metadata.slug, bundle);
  }

  /** Used by tests to swap in a stub provider. */
  unregister(slug: string): void {
    this.bySlug.delete(slug);
  }

  get(slug: string): ProviderBundle | undefined {
    return this.bySlug.get(slug);
  }

  list(filter: { kind?: ProviderKind } = {}): ProviderBundle[] {
    const all = [...this.bySlug.values()];
    if (!filter.kind) return all;
    return all.filter((b) => b.metadata.kinds.includes(filter.kind!));
  }

  reset(): void {
    this.bySlug.clear();
  }
}

const singleton = new Registry();

export function registerProvider(bundle: ProviderBundle): void {
  singleton.register(bundle);
}

export function unregisterProvider(slug: string): void {
  singleton.unregister(slug);
}

export function getProvider(slug: string): ProviderBundle | undefined {
  return singleton.get(slug);
}

export function listProviders(filter: { kind?: ProviderKind } = {}): ProviderBundle[] {
  return singleton.list(filter);
}

/** Test-only: wipe the registry between cases. */
export function _resetRegistryForTest(): void {
  singleton.reset();
}
