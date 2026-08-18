// Permanent redirects for marketplace slugs that changed shape.
//
// Integration listings used to be six hand-written rows with bare slugs (`shippo`,
// `taxjar`, …). They are now DERIVED from the integration registry, and their slugs
// are category-qualified (`shipping-shippo`, `tax-taxjar`) because a slug is only
// unique WITHIN a category — `meta` and `pinterest` are each both a sales channel and
// a social account, and they are different integrations that must not collide on one
// public URL.
//
// The qualified form is the stable one, so the old links redirect to it rather than
// the reverse. Without this they 404: the derived set replaced the hand-written rows
// and the publisher-scoped prune removed the originals, which is retract-by-absence
// working exactly as intended and taking six live URLs with it.
//
// `stripe` is the interesting entry. The old listing pointed at a `provider-stripe`
// package that never existed — the phantom that made a working Stripe integration read
// as missing. Its honest destination is `payments-stripe_direct`, "Your own Stripe",
// which is the real thing the old card was describing.
//
// This map is expected to stay small and to stop growing. Add to it only when a slug
// that was publicly reachable changes.
export const LEGACY_MARKETPLACE_SLUGS: Readonly<Record<string, Record<string, string>>> = {
  integrations: {
    stripe: 'payments-stripe_direct',
    paypal: 'payments-paypal',
    shippo: 'shipping-shippo',
    easypost: 'shipping-easypost',
    taxjar: 'tax-taxjar',
    avalara: 'tax-avalara',
  },
};

/** The current slug for a retired one, or null when the slug was never renamed. */
export function legacySlugTarget(category: string, slug: string): string | null {
  return LEGACY_MARKETPLACE_SLUGS[category]?.[slug] ?? null;
}
