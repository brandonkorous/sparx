// Farm Fresh generator — CMS content (the two seeded blog posts) + their featured
// images. No node() calls here (CMS bodies are ProseMirror docs via `doc()`), so this
// evaluates before any tree is built. Each post carries a self-contained data-URI cover
// image (the same brand-emoji `photoSvg` the catalog uses) referenced by `{ $asset }`,
// so the `blog_post.featuredImage` binding in the post template resolves to a real
// image — the tenant swaps it for real photography post-install.

import { doc } from './_kit';
import { photoSvg } from './media';

/** The seeded posts, each with the `seed` that picks its cover emoji/colour. */
const POSTS = [
  {
    slug: 'sourcing-within-60-miles',
    seed: 'story-care',
    body: {
      title: 'Why we source within 60 miles',
      excerpt: 'Fresher produce, a smaller footprint, and farmers we know by name.',
      body: doc(
        'When we say local, we mean it — every bowl starts with produce picked from partner farms within 60 miles of our counters.',
        'Sourcing close to home means we serve fruit and greens within a day of harvest, support growers in our own community, and keep our footprint small.',
        'It’s more work to build a menu around what’s ripe this week. We think you can taste the difference — and that’s the whole point.'
      ),
    },
  },
  {
    slug: 'eating-with-the-seasons',
    seed: 'strawberry',
    body: {
      title: 'Eating with the seasons',
      excerpt: 'How our menu shifts with what the farms are picking.',
      body: doc(
        'Our menu isn’t fixed — it follows the harvest. Spring leans green and bright; late summer brings stone fruit and berries; winter turns to roots, squash and citrus.',
        'Cooking and blending with the seasons means peak flavor and peak nutrition, with less shipped from far away.',
        'Check the counter for this week’s seasonal bowl — it’s where our team gets to play.'
      ),
    },
  },
] as const;

/** Featured-image assets (one per post) — self-contained data-URI covers, spread into
 *  the manifest's `assets` alongside the product + brand assets. */
export const blogImageAssets = POSTS.map((p) => ({
  id: `img-blog-${p.slug}`,
  url: photoSvg(p.seed),
  alt: p.body.title,
}));

export const content = POSTS.map((p) => ({
  typeKey: 'blog_post',
  slug: p.slug,
  status: 'draft' as const,
  body: {
    ...p.body,
    // `{ $asset }` resolves to the installed MediaAsset id, then validates as the
    // image field's media id (resolveAssetRefs → validateAndNormalizeBody).
    featuredImage: { $asset: `img-blog-${p.slug}` },
  },
}));
