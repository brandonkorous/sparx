// The guard that would have caught the missing `cms.blog_post` default.
//
// That bug shipped because the resolution chain ended in `return null` — a legal
// answer that means "no default for this type", indistinguishable from "someone forgot
// this type". These tests make the distinction checkable: every ROUTED record type must
// have a template, and every template must produce a real tree.

import { describe, expect, it } from 'vitest';
import { toHtml } from '@wizeworks/silicaui-html';

import {
  RECORD_ADDRESSES,
  RECORD_ADDRESS_SLUGS,
  RECORD_TEMPLATES,
  RECORD_TEMPLATE_LABELS,
  ROUTED_RECORD_TYPES,
  isRecordAddress,
  recordAddressAt,
  recordAddressFor,
  recordIndexPath,
  recordPreviewPath,
  recordTemplate,
  slugCandidatesForPath,
} from './record-templates';
import { starterPages, starterSite } from './site';

/** Every host-core key mounted anywhere in a subtree. */
function hostKeys(node: unknown, out: string[] = []): string[] {
  const n = node as { kind?: string; component?: string; children?: unknown[] };
  if (n?.kind === 'host' && n.component) out.push(n.component);
  for (const c of n?.children ?? []) if (c && typeof c === 'object') hostKeys(c, out);
  return out;
}

describe('RECORD_TEMPLATES — every routed record type has a default', () => {
  it('covers every routed record type', () => {
    for (const type of ROUTED_RECORD_TYPES) {
      expect(RECORD_TEMPLATES[type], `no default template for routed type "${type}"`).toBeTypeOf(
        'function'
      );
    }
  });

  it('has no template for a type the platform does not route', () => {
    // Not pedantry: an orphan entry means either a dead composite or — worse — a route
    // someone removed while leaving the template behind, so the pair drifts apart.
    for (const type of Object.keys(RECORD_TEMPLATES)) {
      expect(ROUTED_RECORD_TYPES, `"${type}" has a template but no route`).toContain(type);
    }
  });

  it('labels every template', () => {
    for (const type of ROUTED_RECORD_TYPES) {
      expect(RECORD_TEMPLATE_LABELS[type]).toBeTruthy();
    }
  });

  // A composite that returns an empty wrapper passes a "is it a function" check and
  // still ships a blank page — so assert each template actually puts something on the
  // page. Two legitimate ways to do that, and the first draft of this test only knew
  // about one: the category and service templates are ENTIRELY a pinned host core, which
  // lowers to an empty `<div data-sui-host>` and gets its content from React at runtime.
  // Requiring markup would have failed them for being correct.
  it('every template either renders real markup or mounts a host core', () => {
    for (const type of ROUTED_RECORD_TYPES) {
      const tree = RECORD_TEMPLATES[type]();
      const html = toHtml(tree);
      const substantial = html.length > 200;
      const mountsCore = hostKeys(tree).length > 0;
      expect(
        substantial || mountsCore,
        `"${type}" renders neither markup nor a host core — it would ship a blank page`
      ).toBe(true);
    }
  });

  it('mints a FRESH tree per call (factories, never shared singletons)', () => {
    // A shared tree would be mutated in place by id-stamping on insert, so two records
    // rendered in one process would fight over the same node ids.
    for (const type of ROUTED_RECORD_TYPES) {
      expect(RECORD_TEMPLATES[type]()).not.toBe(RECORD_TEMPLATES[type]());
    }
  });

  describe('recordTemplate()', () => {
    it('resolves a routed type to a labelled tree', () => {
      const t = recordTemplate('cms.blog_post');
      expect(t?.label).toBe('Each blog post');
      expect(t?.root).toBeTruthy();
    });

    it('returns null for an unknown type rather than throwing', () => {
      // A stale client asking for a type we removed must degrade, not 500.
      expect(recordTemplate('commerce.nonsense')).toBeNull();
    });
  });
});

describe('RECORD_ADDRESSES — a record page has a real address', () => {
  it('gives every routed record type exactly one address, and maps back', () => {
    for (const type of ROUTED_RECORD_TYPES) {
      const address = recordAddressFor(type);
      expect(address, `no address for routed type "${type}"`).toBeTruthy();
      expect(recordAddressAt(address!.slug)?.recordType).toBe(type);
    }
    expect(RECORD_ADDRESSES).toHaveLength(ROUTED_RECORD_TYPES.length);
  });

  it('derives the slug from the prefix and the param, so they cannot drift', () => {
    for (const a of RECORD_ADDRESSES) {
      expect(a.slug).toBe(`${a.prefix}:${a.param}`);
      expect(a.prefix.endsWith('/'), `${a.prefix} must end in a slash`).toBe(true);
    }
  });

  it('is the ONLY place a platform slug contains a colon', () => {
    // `:` is a reserved literal here, not a pattern language — the closed set is what
    // lets every lookup on the platform stay an exact string comparison. If a sixth
    // colon-bearing slug ever appears, some reader has to learn to match patterns.
    for (const slug of RECORD_ADDRESS_SLUGS) expect(slug).toContain(':');
    expect(new Set(RECORD_ADDRESS_SLUGS).size).toBe(RECORD_ADDRESS_SLUGS.length);
  });

  it('accepts either stored spelling, because slugs are written both ways by vintage', () => {
    expect(recordAddressAt('/products/:handle')?.recordType).toBe('commerce.product');
    expect(recordAddressAt('products/:handle')?.recordType).toBe('commerce.product');
  });

  it('does NOT treat a visitor path as an address', () => {
    // The distinction the whole design rests on: `/products/brake-kit` is where someone
    // lands, `/products/:handle` is where the page lives.
    expect(recordAddressAt('/products/brake-kit')).toBeNull();
    expect(recordAddressAt('/products/:handle/extra')).toBeNull();
    expect(recordAddressAt('/products/:other')).toBeNull();
    expect(recordAddressAt('/products')).toBeNull();
    expect(recordAddressAt(null)).toBeNull();
    expect(isRecordAddress('/about')).toBe(false);
  });

  it('points Preview at the route index, which is a URL a browser can actually fetch', () => {
    expect(recordIndexPath(recordAddressFor('commerce.product')!)).toBe('/products');
    expect(recordIndexPath(recordAddressFor('cms.blog_post')!)).toBe('/blog');
  });
});

describe('slugCandidatesForPath — one matcher for body and chrome', () => {
  // `getPublishedPageBySlug` and `findPageFrameId` must agree about which page owns a
  // path. If they diverge, a page renders its body from one row and its chrome from
  // another — a product page in the wrong shell, with nothing to explain it.
  it('offers the record address for a path with exactly one segment under the prefix', () => {
    expect(slugCandidatesForPath('/products/brake-kit')).toContain('products/:handle');
    expect(slugCandidatesForPath('/blog/hello-world')).toContain('blog/:slug');
  });

  it('still offers the literal slug first, so an ordinary page wins its own path', () => {
    // `/products` is the INDEX page — an ordinary page with its own row and its own
    // frame. It must not resolve the record page.
    expect(slugCandidatesForPath('/products')).toEqual(['products', '/products']);
  });

  it('does not reach a record page from a deeper path', () => {
    expect(slugCandidatesForPath('/products/a/b')).toEqual(['products/a/b', '/products/a/b']);
  });

  it('never offers a record address for the address spelled literally', () => {
    // Answering this would serve a template with no record bound into it.
    expect(slugCandidatesForPath('/products/:handle')).toEqual([
      'products/:handle',
      '/products/:handle',
    ]);
  });

  it('tolerates a trailing slash without inventing an empty segment', () => {
    expect(slugCandidatesForPath('/products/')).toEqual(['products', '/products']);
    expect(slugCandidatesForPath('/')).toEqual([]);
  });
});

describe('recordPreviewPath', () => {
  const product = recordAddressFor('commerce.product')!;
  const post = recordAddressFor('cms.blog_post')!;

  // The whole reason this exists: an author laying out the product DETAIL page pressed
  // Preview and was shown the product LIST, which contains none of their work.
  it('opens a real record when one is known', () => {
    expect(recordPreviewPath(product, { 'commerce.product': '/products/brake-kit' })).toBe(
      '/products/brake-kit'
    );
  });

  // Not a defect — a tenant with no products has no detail page to show, and the index
  // is a real page. This is also exactly where Preview went before samples existed, so a
  // failed or empty lookup costs nothing.
  it('falls back to the route index when the tenant has no record of that kind', () => {
    expect(recordPreviewPath(product, {})).toBe('/products');
    expect(recordPreviewPath(post, undefined)).toBe('/blog');
    expect(recordPreviewPath(post, null)).toBe('/blog');
  });

  // A mismatched entry would send an author previewing their product page to a blog
  // post, and they would read the TEMPLATE as broken rather than the link as wrong.
  it('ignores a sample that is not under this address prefix', () => {
    expect(recordPreviewPath(product, { 'commerce.product': '/blog/hello-world' })).toBe(
      '/products'
    );
  });

  // `/products` is the index, not a product — interpolating an empty segment would
  // preview the wrong page while looking like it worked.
  it('ignores a sample that is the prefix with nothing after it', () => {
    expect(recordPreviewPath(product, { 'commerce.product': '/products/' })).toBe('/products');
    expect(recordPreviewPath(product, { 'commerce.product': '/products' })).toBe('/products');
  });

  it('reads only its own record type', () => {
    expect(recordPreviewPath(product, { 'cms.blog_post': '/blog/hello-world' })).toBe('/products');
  });

  // Every address must be previewable — a new one added without a sample resolver still
  // has to produce a fetchable path rather than a pattern.
  it('never returns a path containing the address pattern', () => {
    for (const address of RECORD_ADDRESSES) {
      expect(recordPreviewPath(address, {})).not.toContain(':');
    }
  });
});

describe('record page names are the switcher, not a DTO field', () => {
  // Giving record pages an address put them in the page switcher, beside the ordinary
  // pages. A label that merely READS fine on its own is not enough there — it has to be
  // tellable apart from every neighbour, by someone who did not author either.
  const site = starterSite(undefined, {
    commerceEnabled: true,
    cmsEnabled: true,
    schedulingEnabled: true,
  });
  const ordinary = starterPages({
    commerceEnabled: true,
    cmsEnabled: true,
    schedulingEnabled: true,
  }).map((p) => p.name);
  const labels = ROUTED_RECORD_TYPES.map((t) => RECORD_TEMPLATE_LABELS[t]);

  /** Lowercased and de-pluralized — how a name reads at a glance, rather than byte-wise. */
  const glance = (s: string) => s.toLowerCase().trim().replace(/s$/, '');

  it('does not collide with an ordinary page name, even as a near-miss', () => {
    // The real bug this exists for: `Collection` (the record page) sat one letter from
    // `Collections` (the index) in the same list. Exact-equality would have called that
    // fine. It was a coin flip for every owner who met it.
    for (const label of labels) {
      for (const name of ordinary) {
        expect(
          glance(label) === glance(name),
          `record page "${label}" is indistinguishable from the "${name}" page at a glance`
        ).toBe(false);
      }
    }
  });

  it('is distinguishable from every OTHER record page', () => {
    expect(new Set(labels.map(glance)).size).toBe(labels.length);
  });

  it('uses one shape for all five, so none reads as a different kind of thing', () => {
    // Three of the five used to carry a `detail` suffix and two did not, which implied a
    // distinction that does not exist. Consistency here IS the meaning.
    for (const label of labels) expect(label.startsWith('Each ')).toBe(true);
  });

  it('speaks no developer vocabulary', () => {
    // The audience is a salon owner, not the person who named the record type.
    for (const label of labels) {
      expect(/detail|record|template|entity|slug|handle|singleton/i.test(label)).toBe(false);
    }
  });

  it('names every seeded record page from this list, so the switcher cannot drift', () => {
    const seeded = site.pages.filter((p) => isRecordAddress(p.slug));
    expect(seeded.length).toBe(ROUTED_RECORD_TYPES.length);
    for (const page of seeded) expect(labels).toContain(page.name);
  });
});
