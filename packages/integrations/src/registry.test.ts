import { beforeEach, describe, expect, it } from 'vitest';

import { isCategoryUnlocked, categoryInfo } from './categories.js';
import {
  defineIntegrationKind,
  IntegrationNotFoundError,
  listIntegrationDescriptors,
  listIntegrations,
  _resetIntegrationsForTest,
} from './registry.js';
import type { IntegrationDescriptor } from './types.js';

interface FakeGateway {
  charge(): string;
}
interface FakeSocial {
  post(): string;
}

function descriptor(over: Partial<IntegrationDescriptor> = {}): IntegrationDescriptor {
  return {
    category: 'payments',
    slug: 'acme_pay',
    name: 'Acme Pay',
    vendor: 'Acme, Inc.',
    blurb: 'Take card payments.',
    publisher: 'sparx',
    availability: 'available',
    connect: 'api_keys',
    credentialFields: [],
    capabilities: ['Cards'],
    ...over,
  };
}

beforeEach(() => {
  _resetIntegrationsForTest();
});

describe('typed kind facades share one registry', () => {
  it('keeps each domain adapter at its own type while listing across categories', () => {
    const payments = defineIntegrationKind<FakeGateway>('payments');
    const social = defineIntegrationKind<FakeSocial>('social');

    payments.register(descriptor(), { charge: () => 'charged' });
    social.register(descriptor({ category: 'social', slug: 'acme_social', name: 'Acme Social' }), {
      post: () => 'posted',
    });

    // Dispatch stays typed per domain...
    expect(payments.require('acme_pay').charge()).toBe('charged');
    expect(social.require('acme_social').post()).toBe('posted');

    // ...while the catalog is one call, not two.
    expect(listIntegrationDescriptors().map((d) => d.slug)).toEqual(['acme_pay', 'acme_social']);
  });

  it('scopes a slug to its category, so `meta` can be both a channel and a social account', () => {
    const channels = defineIntegrationKind<FakeGateway>('sales_channels');
    const social = defineIntegrationKind<FakeSocial>('social');

    channels.register(
      descriptor({ category: 'sales_channels', slug: 'meta', name: 'Meta Shops' }),
      { charge: () => 'channel' }
    );
    social.register(descriptor({ category: 'social', slug: 'meta', name: 'Facebook Page' }), {
      post: () => 'social',
    });

    expect(channels.descriptor('meta')?.name).toBe('Meta Shops');
    expect(social.descriptor('meta')?.name).toBe('Facebook Page');
    expect(listIntegrations()).toHaveLength(2);
  });

  it('refuses a descriptor registered on the wrong kind', () => {
    const payments = defineIntegrationKind<FakeGateway>('payments');
    expect(() => {
      payments.register(descriptor({ category: 'social' }));
    }).toThrow(/declares category "social"/);
  });

  it('throws a named error on a dispatch miss', () => {
    const payments = defineIntegrationKind<FakeGateway>('payments');
    expect(() => payments.require('nope')).toThrow(IntegrationNotFoundError);
  });
});

describe('collision policy', () => {
  // The regression this package exists to prevent: the old registries threw on a
  // duplicate slug, so a second boot (HMR, per-case app construction) raised, and
  // bootstrapProviders() had to regex-match "already registered" to tell a real
  // failure from a benign one.
  it('is idempotent, so a double bootstrap is a no-op rather than a throw', () => {
    const payments = defineIntegrationKind<FakeGateway>('payments');
    const register = () => {
      payments.register(descriptor(), { charge: () => 'v1' });
    };

    expect(register).not.toThrow();
    expect(register).not.toThrow();
    expect(listIntegrations({ category: 'payments' })).toHaveLength(1);
  });

  it('lets a later registration replace an earlier one', () => {
    const payments = defineIntegrationKind<FakeGateway>('payments');
    payments.register(descriptor(), { charge: () => 'v1' });
    payments.register(descriptor(), { charge: () => 'v2' });
    expect(payments.require('acme_pay').charge()).toBe('v2');
  });
});

describe('descriptor-only entries', () => {
  it('lists an integration with no adapter but reports no adapter to dispatch', () => {
    const ai = defineIntegrationKind<FakeGateway>('ai');
    ai.register(descriptor({ category: 'ai', slug: 'anthropic', name: 'Anthropic' }));

    expect(ai.has('anthropic')).toBe(true);
    expect(ai.get('anthropic')).toBeUndefined();
    expect(ai.adapters()).toEqual([]);
    expect(ai.descriptors()).toHaveLength(1);
  });
});

describe('ordering', () => {
  it('sorts by weight then name so every surface lists a category identically', () => {
    const payments = defineIntegrationKind<FakeGateway>('payments');
    payments.register(descriptor({ slug: 'zebra', name: 'Zebra' }));
    payments.register(descriptor({ slug: 'alpha', name: 'Alpha' }));
    payments.register(descriptor({ slug: 'heavy', name: 'Heavy', sortWeight: 10 }));

    expect(payments.descriptors().map((d) => d.name)).toEqual(['Heavy', 'Alpha', 'Zebra']);
  });
});

describe('category gates', () => {
  // Getting paid is not selling-only: NormalizedPaymentData carries invoiceId and
  // bookingId, so an invoicing-only or scheduling-only tenant needs a gateway. The
  // live /v1/commerce/providers route answers MODULE_DISABLED for them.
  it('unlocks payments for an invoicing-only or scheduling-only tenant', () => {
    expect(isCategoryUnlocked('payments', ['invoicing'])).toBe(true);
    expect(isCategoryUnlocked('payments', ['scheduling'])).toBe(true);
    expect(isCategoryUnlocked('payments', ['cms'])).toBe(false);
  });

  it('keeps shipping tied to selling', () => {
    expect(isCategoryUnlocked('shipping', ['commerce'])).toBe(true);
    expect(isCategoryUnlocked('shipping', ['invoicing'])).toBe(false);
  });

  it('describes every category in the owner-facing wording', () => {
    expect(categoryInfo('payments').label).toBe('Card payments');
    expect(categoryInfo('sales_channels').label).toBe('Places you sell');
  });
});
