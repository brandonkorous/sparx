// A record template, resolved against an actual record.
//
// `record-templates.test.ts` proves each template exists, mints a fresh tree, and puts
// SOMETHING on the page. What nothing checked is the only thing a record template is
// for: that binding a record to it makes the record appear. A template that renders
// beautifully and shows "Product name / $0.00" for every product in the catalogue passes
// every existing assertion — and that is not a hypothetical, it is a bug this codebase
// has already had, when blog cards bound `image` where the record carries
// `featuredImage` and every post rendered its placeholder.
//
// So this binds a real record and asserts the record's own words come out the other end.
// Only the two templates that HAVE bindings are covered; collection, category and
// service are entirely pinned host cores that get their content from React at runtime,
// which `record-templates.test.ts` already accounts for.

import { describe, expect, it } from 'vitest';
import { resolveTree, toHtml, type DataScope } from '@wizeworks/silicaui-html';

import { RECORD_TEMPLATES } from './record-templates';
import { finalizeTree } from './render';

/** Read `a.b.c` off an object, tolerating a missing link. */
function readPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, source);
}

/** A host over one record, following the engine's contract exactly: `undefined` for a
 *  ref it does not know (authored content stays), `{ value }` for one it does. */
function hostFor(collections: Record<string, readonly unknown[]>) {
  return {
    // The RECORD's own array fields are collections too — `descriptionParagraphs`,
    // `versions`, `attributeSections` all repeat off the product in scope, and
    // `createSilicaResolver` answers them from `scope.item` exactly like a scalar.
    // A double that only knew the named root sources reported those refs as UNKNOWN,
    // which is the failure mode a double must never invent: it turns a working bind
    // into a red test and, worse, would have hidden a broken one.
    resolveCollection: (ref: string, scope: DataScope) => {
      const fromItem = readPath(scope.item, ref);
      if (Array.isArray(fromItem)) return fromItem as readonly unknown[];
      return collections[ref];
    },
    resolveBinding: (ref: string, scope: DataScope) => {
      const fromItem = readPath(scope.item, ref);
      if (fromItem !== undefined) return { value: fromItem };
      return undefined;
    },
  };
}

const PRODUCT = {
  title: 'Harbour Rope Lamp',
  price: '$148.00',
  compareAtPrice: '$180.00',
  description: 'Turned oak and marine rope, made a mile from the water.',
  // The buy box reads PARAGRAPHS (issue 191) — a bind writes one text node and the
  // blank lines an owner typed collapse. The flat string stays for the cards.
  descriptionParagraphs: [{ text: 'Turned oak and marine rope, made a mile from the water.' }],
  image: 'https://cdn.test/harbour-rope-lamp.jpg',
  variantId: 'var_9912',
  // Sold in three sizes, so the buy box shows the picker and drops its hidden field
  // (issue 190).
  versions: [
    { id: 'var_9912', label: 'Small' },
    { id: 'var_9913', label: 'Medium' },
    { id: 'var_9914', label: 'Large, sold out' },
  ],
  url: '/products/harbour-rope-lamp',
};

/** The product template carries a "you might also like" rail bound to
 *  `commerce.featured`. Left empty it renders its own placeholder card — correctly, the
 *  same way the starter's grid does — so a PDP assertion about placeholders has to fill
 *  the rail or it is really testing the rail's empty state. */
const ALSO_LIKE = {
  title: 'Dock Cleat Bookend',
  price: '$64.00',
  image: 'https://cdn.test/dock-cleat-bookend.jpg',
  url: '/products/dock-cleat-bookend',
};

const POST = {
  title: 'What we learned rigging a thousand lamps',
  excerpt: 'Rope stretches. Oak moves. Here is how we stopped fighting it.',
  date: 'August 6, 2026',
  featuredImage: 'https://cdn.test/rigging.jpg',
};

const render = (
  type: keyof typeof RECORD_TEMPLATES,
  collections: Record<string, readonly unknown[]>
) => toHtml(finalizeTree(resolveTree(RECORD_TEMPLATES[type](), hostFor(collections))));

describe('a record template shows the record', () => {
  it('the product page renders the product, not the placeholder', () => {
    const html = render('commerce.product', {
      product: [PRODUCT],
      'commerce.featured': [ALSO_LIKE],
    });

    expect(html, 'title').toContain(PRODUCT.title);
    expect(html, 'featured rail').toContain(ALSO_LIKE.title);
    expect(html, 'price').toContain(PRODUCT.price);
    expect(html, 'description').toContain(PRODUCT.description);
    expect(html, 'image').toContain(PRODUCT.image);

    // The placeholder copy the template authors must be GONE once a record is bound —
    // its presence alongside a real product is what "the binding silently broke" looks
    // like on a live PDP.
    expect(html, 'placeholder title survived').not.toContain('Product name');
    expect(html, 'placeholder price survived').not.toContain('$0.00');
    expect(html, 'placeholder image survived').not.toContain('/placeholder-image.svg');
  });

  it('the blog post page renders the post', () => {
    const html = render('cms.blog_post', { blog_post: [POST] });

    expect(html, 'title').toContain(POST.title);
    expect(html, 'excerpt').toContain(POST.excerpt);
    expect(html, 'date').toContain(POST.date);
    // The ref this template binds for its picture is `featuredImage`, not `image` —
    // the exact pair that has been transposed before.
    expect(html, 'featuredImage').toContain(POST.featuredImage);
  });

  it('falls back to the placeholder picture when the record has no image', () => {
    // The other half of the contract: a real record with no picture must still not
    // render a broken image. This is `fillMissingImageSrc` doing its job on the record
    // path rather than the empty-catalog one.
    const html = render('commerce.product', {
      product: [{ ...PRODUCT, image: '' }],
      'commerce.featured': [ALSO_LIKE],
    });
    expect(html).toContain(PRODUCT.title);
    for (const tag of html.match(/<img[^>]*>/g) ?? []) {
      expect(/\ssrc="[^"]+"/.test(tag), `<img> with no src — ${tag.slice(0, 80)}`).toBe(true);
    }
  });
});
