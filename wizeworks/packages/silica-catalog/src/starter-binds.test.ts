// The guard for the failure that has now shipped THREE times: a data bind on a page
// where nothing puts its record in scope, so it silently renders its placeholder.
//
//   · the PDP breadcrumb read "Shop / Product" on every product page;
//   · the Journal cards all linked to the literal string `/blog`;
//   · `/shop` — a primary nav destination — read "Collection / Collection description."
//     on EVERY tenant, because the starter built it from `collectionHeader()`, whose
//     binds resolve against a collection that a plain page never has.
//
// The through-line: a `value` bind is only meaningful inside a scope that supplies the
// record. At the root of an ordinary page there is nothing to resolve against, so the
// bind quietly does nothing and the placeholder text — which exists to make the studio
// canvas legible — ships to production as if it were copy.
//
// So: every STARTER page (an ordinary page, not a record template) must carry no
// scope-relative binds outside a collection scope. Record templates are exactly the
// pages that legitimately do, and they are tested separately in cms/commerce tests.

import { describe, expect, it } from 'vitest';

import { starterPages } from './site';

/** Refs that resolve at the ROOT of any page, with no record in scope — the site's own
 *  identity, which the host always supplies. Everything else needs a scope. */
const ROOT_PREFIX = 'site.';

/** Every scope-relative `value` ref that is NOT inside a collection scope. Descends
 *  with a flag: once inside a node marked `kind: 'collection'`, binds below it have a
 *  record to resolve against and are fine. */
function unscopedBinds(node: unknown, inScope = false, out: string[] = []): string[] {
  if (!node || typeof node !== 'object') return out;
  const n = node as {
    data?: { kind?: string; ref?: string };
    children?: unknown[];
    class?: string;
  };
  const scoped = inScope || n.data?.kind === 'collection';
  if (n.data?.kind === 'value' && n.data.ref && !scoped && !n.data.ref.startsWith(ROOT_PREFIX)) {
    out.push(n.data.ref);
  }
  for (const c of n.children ?? []) unscopedBinds(c, scoped, out);
  return out;
}

describe('starter pages carry no bind that cannot resolve', () => {
  // Both module shapes: a commerce tenant and a content-only one get different pages.
  const configs = [
    { label: 'commerce + cms + scheduling', opts: { cmsEnabled: true, schedulingEnabled: true } },
    { label: 'content only', opts: { commerceEnabled: false, cmsEnabled: true } },
  ];

  for (const { label, opts } of configs) {
    it(`resolves every bind on every starter page (${label})`, () => {
      for (const page of starterPages(opts)) {
        const bad = unscopedBinds(page.root);
        expect(
          bad,
          `page "${page.name}" (${page.slug}) binds ${bad.join(', ')} with no record in scope — ` +
            `those render their PLACEHOLDER text to real visitors`
        ).toEqual([]);
      }
    });
  }

  it('still allows a bind inside a collection scope', () => {
    // Sanity-check the walker itself: if it treated everything as unscoped it would
    // pass the suite above by being blind rather than by the pages being correct.
    const scopedTree = {
      data: { kind: 'collection', ref: 'cms.blog_post' },
      children: [{ data: { kind: 'value', ref: 'title' }, children: [] }],
    };
    expect(unscopedBinds(scopedTree)).toEqual([]);

    const unscopedTree = { children: [{ data: { kind: 'value', ref: 'title' }, children: [] }] };
    expect(unscopedBinds(unscopedTree)).toEqual(['title']);
  });
});
