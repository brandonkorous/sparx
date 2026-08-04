// The one integration registry.
//
// Entries are keyed `category:slug` and hold a serializable descriptor plus the
// domain's own adapter, carried opaque. Nothing here knows what a `PaymentGateway`
// or a `SocialAdapter` can do — that is the point. The shared half is the lookup;
// the typed half stays with the domain, reached through `defineIntegrationKind`.
//
// COLLISION POLICY: last registration wins, and it is deliberate.
//
// The registries this replaces disagreed. The provider framework and the channel
// registry THREW on a duplicate slug; the social registry took last-wins. Throwing
// reads as the safer choice and is not: a service that boots twice (HMR, a test that
// builds the app per case, two callers each ensuring their own adapters) hits it on
// the second pass, which is why `bootstrapProviders()` carries a `catch` that regex
// -matches the string "already registered" to decide whether an exception was real.
// A policy you have to pattern-match error messages to survive is the wrong policy.
// Re-registering the same slug is idempotent here, so bootstrap can simply run.

import type { IntegrationCategory, IntegrationDescriptor } from './types.js';

export interface IntegrationEntry<T = unknown> {
  descriptor: IntegrationDescriptor;
  /** The domain's adapter. Absent for an integration whose behaviour lives elsewhere
   *  (a BYOK credential the API verifies directly, a manual CSV connector). A
   *  descriptor with no adapter is still a real catalog entry — it just has nothing
   *  to dispatch. */
  adapter?: T;
}

function keyOf(category: IntegrationCategory, slug: string): string {
  return `${category}:${slug}`;
}

class IntegrationRegistry {
  private readonly entries = new Map<string, IntegrationEntry>();

  register(entry: IntegrationEntry): void {
    this.entries.set(keyOf(entry.descriptor.category, entry.descriptor.slug), entry);
  }

  get(category: IntegrationCategory, slug: string): IntegrationEntry | undefined {
    return this.entries.get(keyOf(category, slug));
  }

  has(category: IntegrationCategory, slug: string): boolean {
    return this.entries.has(keyOf(category, slug));
  }

  unregister(category: IntegrationCategory, slug: string): void {
    this.entries.delete(keyOf(category, slug));
  }

  list(filter: { category?: IntegrationCategory } = {}): IntegrationEntry[] {
    const all = [...this.entries.values()];
    const scoped = filter.category
      ? all.filter((e) => e.descriptor.category === filter.category)
      : all;
    return scoped.sort(compareDescriptors);
  }

  reset(): void {
    this.entries.clear();
  }
}

/** Descriptor order: heavier weight first, then alphabetical. Applied once here so
 *  every surface lists a category in the same order without re-sorting. */
function compareDescriptors(a: IntegrationEntry, b: IntegrationEntry): number {
  const weight = (b.descriptor.sortWeight ?? 0) - (a.descriptor.sortWeight ?? 0);
  if (weight !== 0) return weight;
  return a.descriptor.name.localeCompare(b.descriptor.name);
}

const singleton = new IntegrationRegistry();

/* ── Cross-category reads (the catalog plane) ─────────────────────────────────── */

/** Every registered integration, in category-then-sort order. This is what the
 *  Integrations panel and the marketplace projection read — one call, not six. */
export function listIntegrations(
  filter: { category?: IntegrationCategory } = {}
): IntegrationEntry[] {
  return singleton.list(filter);
}

/** Just the descriptors — the serializable half, for anything crossing the wire. */
export function listIntegrationDescriptors(
  filter: { category?: IntegrationCategory } = {}
): IntegrationDescriptor[] {
  return singleton.list(filter).map((e) => e.descriptor);
}

export function getIntegration(
  category: IntegrationCategory,
  slug: string
): IntegrationEntry | undefined {
  return singleton.get(category, slug);
}

/** Test-only: drop every registration so a suite starts from a known-empty plane. */
export function _resetIntegrationsForTest(): void {
  singleton.reset();
}

/* ── Typed per-kind facades ───────────────────────────────────────────────────── */

/**
 * A category's typed view of the shared registry.
 *
 * `@sparx/payments` gets `IntegrationKind<PaymentGateway>`, `@sparx/social` gets
 * `IntegrationKind<SocialAdapter>` — same storage underneath, so one panel can list
 * everything, while `require()` still hands back the domain's real adapter type and
 * dispatch stays as typed as it was before.
 */
export interface IntegrationKind<T> {
  readonly category: IntegrationCategory;
  register(descriptor: IntegrationDescriptor, adapter?: T): void;
  get(slug: string): T | undefined;
  /** The adapter or throw — for dispatch paths where a miss is a wiring bug rather
   *  than something a tenant did. */
  require(slug: string): T;
  has(slug: string): boolean;
  descriptor(slug: string): IntegrationDescriptor | undefined;
  descriptors(): IntegrationDescriptor[];
  /** Every registered adapter in this category, skipping descriptor-only entries. */
  adapters(): T[];
  unregister(slug: string): void;
}

export class IntegrationNotFoundError extends Error {
  constructor(
    readonly category: IntegrationCategory,
    readonly slug: string
  ) {
    super(`No ${category} integration registered for "${slug}".`);
    this.name = 'IntegrationNotFoundError';
  }
}

/** Claim a category and get a typed handle on it. Called once per domain package. */
export function defineIntegrationKind<T>(category: IntegrationCategory): IntegrationKind<T> {
  return {
    category,

    register(descriptor, adapter) {
      if (descriptor.category !== category) {
        throw new Error(
          `Descriptor "${descriptor.slug}" declares category "${descriptor.category}" but was registered on the "${category}" kind.`
        );
      }
      singleton.register({ descriptor, adapter });
    },

    get(slug) {
      return singleton.get(category, slug)?.adapter as T | undefined;
    },

    require(slug) {
      const adapter = singleton.get(category, slug)?.adapter as T | undefined;
      if (!adapter) throw new IntegrationNotFoundError(category, slug);
      return adapter;
    },

    has(slug) {
      return singleton.has(category, slug);
    },

    descriptor(slug) {
      return singleton.get(category, slug)?.descriptor;
    },

    descriptors() {
      return singleton.list({ category }).map((e) => e.descriptor);
    },

    adapters() {
      return singleton
        .list({ category })
        .map((e) => e.adapter as T | undefined)
        .filter((a): a is T => a !== undefined);
    },

    unregister(slug) {
      singleton.unregister(category, slug);
    },
  };
}
