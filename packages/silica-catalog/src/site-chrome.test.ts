// The site chrome's brand mark — the `site.brand` HOST core.
//
// What these lock is the SORT, not the styling: the mark must be a host node, because a
// stamped mark freezes at publish. That is not hypothetical — it is how tenants who
// published before silica's `Wordmark` could hold a logo ended up with a text-only
// header that no fix to the composite could ever reach. If someone "simplifies" this
// back into a stamped lockup, that whole class of bug returns silently, and these tests
// are the alarm.

import { describe, expect, it } from 'vitest';

import { siteNavbar } from './site-chrome';
import { HOST_COMPONENTS, HOST_KEYS, hostCore } from './host-nodes';

const navBrand = (opts = {}) => {
  const nav = siteNavbar(opts) as { children?: unknown[] };
  return (nav.children ?? [])[0] as Record<string, unknown>;
};

describe('siteNavbar — the brand mark', () => {
  it('seeds the brand as a HOST node, so the platform renders it live', () => {
    const brand = navBrand();
    // `kind: "host"` is the whole point: the tree stores a mount point, so a logo
    // uploaded in Site settings reaches the header with no re-author and no re-publish.
    expect(brand.kind).toBe('host');
    expect(brand.component).toBe(HOST_KEYS.siteBrand);
  });

  it('does NOT lock the brand — the tenant owns where their own mark sits', () => {
    // Unlike a functional core, the brand protects no transaction. Locking it would
    // forbid MOVE as well as remove (silicaui: "a locked node cannot be removed, moved,
    // or reparented"), so the tenant could not center their logo or place it after the
    // nav links. Improvability comes from `kind:"host"`; `locked` is orthogonal.
    expect(navBrand().locked).toBeUndefined();
  });

  it('is the FIRST child of the nav, so the header leads with the brand', () => {
    expect(navBrand({ commerceEnabled: true, schedulingEnabled: true }).component).toBe(
      HOST_KEYS.siteBrand
    );
    // …and independent of which modules are on: the brand is not module-gated.
    expect(navBrand({ commerceEnabled: false, schedulingEnabled: false }).component).toBe(
      HOST_KEYS.siteBrand
    );
  });

  it('carries the registered `show` default, matching a palette insert', () => {
    // A seeded core must behave identically to one dragged from the palette (which gets
    // its defaults from the Inspector). Without this the storefront would be relying on
    // its own fallback, and the two could drift.
    expect(navBrand().props).toEqual({ show: 'both' });
  });

  it('keeps the `wordmark` class — silicaui sizes the mark through it', () => {
    // `.wordmark & :is(svg,img)` is what makes this a real Wordmark rather than a
    // lookalike lockup; dropping the class silently un-sizes every tenant's logo.
    expect(String(navBrand().class)).toContain('wordmark');
  });
});

describe('hostCore — pinning is opt-out, and only the brand opts out', () => {
  it('locks a functional core by default', () => {
    // Safe by omission: a NEW core is protected unless someone deliberately says
    // otherwise, so forgetting `pinned` can never ship a deletable checkout.
    expect(hostCore(HOST_KEYS.commerceCart).locked).toBe('host');
    expect(hostCore(HOST_KEYS.commerceAuth).locked).toBe('host');
  });

  it('leaves an opted-out core unlocked', () => {
    expect(hostCore(HOST_KEYS.siteBrand).locked).toBeUndefined();
  });

  it('the brand is the ONLY unpinned core in the registry', () => {
    // A tripwire, not a style rule: every other core wraps a live transaction the
    // tenant must not be able to delete. If this fails, either a functional core just
    // became deletable, or a second improvability-only core landed and this comment
    // needs rewriting — both are worth a human look.
    const unpinned = HOST_COMPONENTS.filter((c) => c.pinned === false).map((c) => c.key);
    expect(unpinned).toEqual([HOST_KEYS.siteBrand]);
  });
});
