// The per-record-type default template registry.
//
// WHY THIS IS A REGISTRY AND NOT A SWITCH. The storefront used to resolve a record
// type's default template through a chain of `if (recordType === …) return …` in
// `starterCollectionDto` (apps/site), ending in `return null`. `cms.blog_post` was
// missing from that chain, and the failure was completely silent: null is a legal
// answer meaning "this type has no default", so posts simply fell through to the bare
// no-template fallback. A tenant wrote a good post and got a page that looked like a
// draft, and nothing anywhere said why.
//
// A map plus a declared list of the types the platform actually ROUTES turns that into
// something a test can check: `record-templates.test.ts` asserts the two agree, so
// adding a `/whatever/[id]` route without a default template fails the suite instead of
// shipping a bare page. The registry is the contract; the routes are the proof.

import type { Node } from '@wizeworks/silicaui-html';

import { blogPostPage } from './cms';
import { categoryDetailPage, collectionDetailPage, productDetailPage } from './commerce';
import { serviceDetailPage } from './scheduling';

/** Every record type the storefront has a per-record ROUTE for — the list each entry
 *  in `RECORD_TEMPLATES` must cover.
 *
 *  Keep in step with the `getPublishedSilicaCollection(...)` call sites under
 *  `apps/site/app`: today `products/[handle]`, `collections/[handle]`,
 *  `category/[handle]`, `book/[serviceId]`, `blog/[slug]`. A route with no entry here
 *  renders its records through the bare fallback — which is exactly the bug this file
 *  exists to make impossible to reintroduce quietly. */
export const ROUTED_RECORD_TYPES = [
  'commerce.product',
  'commerce.collection',
  'commerce.category',
  'scheduling.service',
  'cms.blog_post',
] as const;

export type RoutedRecordType = (typeof ROUTED_RECORD_TYPES)[number];

/** A record type → the code-authored template that renders one of its records until
 *  the tenant publishes their own. Each factory returns a FRESH, id-free tree.
 *
 *  These reach EVERY tenant who has not authored a template, including ones that
 *  already exist, and keep improving — a stored tree freezes at publish (docs/122: a
 *  composite change never re-authors a saved page), so a seeded starter page would only
 *  ever help tenants created after it shipped. */
export const RECORD_TEMPLATES: Record<RoutedRecordType, () => Node> = {
  'commerce.product': productDetailPage,
  'commerce.collection': collectionDetailPage,
  'commerce.category': categoryDetailPage,
  'scheduling.service': serviceDetailPage,
  'cms.blog_post': blogPostPage,
};

/** A human label per record type, for the DTO the storefront wraps the tree in. */
export const RECORD_TEMPLATE_LABELS: Record<RoutedRecordType, string> = {
  'commerce.product': 'Product detail',
  'commerce.collection': 'Collection',
  'commerce.category': 'Category detail',
  'scheduling.service': 'Service detail',
  'cms.blog_post': 'Blog post',
};

/** The default template for a record type, or null when the platform has none.
 *  Null stays a legal answer — an unknown type from a stale client must not throw —
 *  but the registry above plus its test is what keeps a ROUTED type from hitting it. */
export function recordTemplate(recordType: string): { label: string; root: Node } | null {
  const key = recordType as RoutedRecordType;
  const factory = RECORD_TEMPLATES[key];
  if (!factory) return null;
  return { label: RECORD_TEMPLATE_LABELS[key], root: factory() };
}
