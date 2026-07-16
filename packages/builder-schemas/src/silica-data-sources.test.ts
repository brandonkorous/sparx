// Locks the picker's ref vocabulary against the resolver's — the two must agree or a
// binding made in the UI silently resolves to nothing.
//
// The regression this guards (docs/122): `site.identity` is AMBIENT root data, so the
// picker emitted a bare `logo` for "Brand identity > Logo". `resolvePath` read that as
// `root.logo` → undefined, so binding the tenant logo onto a wordmark rendered EMPTY —
// and, because a bound node's value replaces its authored content, also wiped the text
// that was there. Ambient fields must be fully-qualified so they resolve at the root.

import { describe, expect, it } from 'vitest';

import { SITE_SOURCES, COMMERCE_SOURCES, type DataSource } from './binding';
import { toSilicaDataSources } from './silica-data-sources';
import { createSilicaResolver, defaultSilicaFormat } from './silica-resolve';

const find = (sources: DataSource[], key: string): DataSource => {
  const s = sources.find((x) => x.key === key);
  if (!s) throw new Error(`no source ${key}`);
  return s;
};

describe('toSilicaDataSources — ambient vs scope-relative field keys', () => {
  it('fully-qualifies an AMBIENT source’s fields so they resolve at the root', () => {
    const identity = toSilicaDataSources([find(SITE_SOURCES, 'site.identity')])[0]!;
    const keys = (identity.fields ?? []).map((f) => f.key);
    expect(keys).toContain('site.identity.logo');
    expect(keys).toContain('site.identity.name');
    expect(keys).not.toContain('logo'); // the bare key that resolved to nothing
  });

  it('qualifies EVERY source’s fields — the five product-shaped sources must not collide', () => {
    // `commerce.product` / `commerce.featured` / `commerce.new` / `commerce.related` /
    // `product` all carry PRODUCT_FIELDS. Bare keys emit `title` five times: five
    // colliding picker options keyed by an identical value.
    const productish = ['commerce.product', 'commerce.featured', 'commerce.new', 'product'];
    const keys = productish.flatMap(
      (k) => toSilicaDataSources([find(COMMERCE_SOURCES, k)])[0]?.fields?.map((f) => f.key) ?? []
    );
    const titles = keys.filter((k) => k.endsWith('.title'));
    expect(titles.length).toBeGreaterThan(1); // several sources DO expose a title…
    expect(new Set(titles).size).toBe(titles.length); // …and every one is distinct
    expect(titles).toContain('commerce.product.title');
    expect(keys).not.toContain('title'); // the bare fragment is gone
  });

  it('the key the picker emits for the logo actually resolves through the resolver', () => {
    const identity = toSilicaDataSources([find(SITE_SOURCES, 'site.identity')])[0]!;
    const logoKey = (identity.fields ?? []).find((f) => f.label === 'Logo')?.key ?? '';
    const url = 'https://cdn.example.test/logo.svg';
    const resolver = createSilicaResolver({
      root: { site: { identity: { name: 'Acme', tagline: '', logo: { url, alt: 'Acme' } } } },
      format: defaultSilicaFormat,
    });
    // The full round trip: the ref the PICKER writes → what the CANVAS renders.
    // Non-null: a picker-emitted key MUST be a ref the resolver knows — `undefined`
    // here would mean the picker offers a binding the canvas can't resolve, which is
    // exactly the bug this file guards.
    expect(resolver.resolveBinding(logoKey, {})!.value).toBe(url);
  });
});

describe('unknown vs empty refs (silica ResolveHost contract)', () => {
  const resolver = createSilicaResolver({
    root: { site: { identity: { name: 'Acme', tagline: '', logo: null } } },
    format: defaultSilicaFormat,
  });

  it('returns undefined for an UNKNOWN ref, so the node keeps its authored content', () => {
    // The exact broken binding this incident produced: the bare field key the picker
    // used to emit. It resolves against `root.logo` — no such path. Reporting it as
    // unknown makes the engine keep the authored wordmark and fire a diagnostic;
    // returning `{ value: undefined }` would silently BLANK the node instead.
    expect(resolver.resolveBinding('logo', {})).toBeUndefined();
    expect(resolver.resolveBinding('nope.not.here', {})).toBeUndefined();
  });

  it('returns a value for a KNOWN ref that is legitimately empty', () => {
    // `logo: null` is a real field on a tenant with no logo uploaded — known, empty.
    // It must NOT be conflated with the unknown ref above. The null passes THROUGH
    // the formatter (its image-unwrap only fires for a `{ url }` object), so the
    // distinction rides on `resolved` being defined at all, not on its value.
    const resolved = resolver.resolveBinding('site.identity.logo', {});
    expect(resolved).toBeDefined();
    expect(resolved!.value).toBeNull();

    const tagline = resolver.resolveBinding('site.identity.tagline', {});
    expect(tagline).toBeDefined();
    expect(tagline!.value).toBe('');
  });

  it('returns undefined for an unknown COLLECTION ref (authored children stay)', () => {
    expect(resolver.resolveCollection('site.identity.nothing', {})).toBeUndefined();
  });

  it('HIDES an unknown ref instead when hideWhenEmpty is on (the email conditional)', () => {
    // docs/120: an email conditional is a bound wrapper that must VANISH when its data
    // is absent — otherwise "Shipping to:" renders with no address. An absent field
    // resolves to nothing, which is precisely the condition `hideWhenEmpty` opts into,
    // so it must not be reported as an unknown ref (which would keep the block).
    const email = createSilicaResolver({
      root: { order: { total: 42 } },
      hideWhenEmpty: true,
    });
    expect(email.resolveBinding('order.shippingAddress', {})).toEqual({
      value: undefined,
      visible: false,
    });
    // …while the SITE builder (hideWhenEmpty off) keeps the authored placeholder.
    const site = createSilicaResolver({ root: { order: { total: 42 } } });
    expect(site.resolveBinding('order.shippingAddress', {})).toBeUndefined();
  });
});
