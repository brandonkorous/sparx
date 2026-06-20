// Tempo generator — CMS content (three seeded news / editorial posts) + their cover
// images. No node() calls here (CMS bodies are ProseMirror docs via `doc()`), so this
// evaluates before any tree is built. Each post carries a self-contained data-URI cover
// (a campaign-gradient panel with a big sport emoji, echoing the home campaign tiles)
// referenced by `{ $asset }`, so the `blog_post.featuredImage` binding in the article
// template resolves to a real image — the tenant swaps it post-install.
//
// The story-detail route is `/blog/<slug>` (the blog_post collection template). The News
// INDEX lives at `/news`, NOT `/blog` — the `blog/[slug]` route owns that segment, so a
// singleton at `/blog` would 404 (the catalog footgun in marketplace-catalog/CLAUDE.md).

import { doc } from './_kit';
import { CAMPAIGN } from './theme';

/** A font-free wide cover: a campaign gradient with a big centered sport emoji. Stays
 *  well under the media_assets.key 1024-char cap. */
const cover = (fromHex: string, toHex: string, emoji: string): string => {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${fromHex}"/><stop offset="1" stop-color="${toHex}"/>` +
    `</linearGradient></defs>` +
    `<rect width="1200" height="630" fill="url(#g)"/>` +
    `<text x="600" y="345" font-size="300" text-anchor="middle" dominant-baseline="central" ` +
    `font-family="'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif">${emoji}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

/** The seeded news posts. `glyph` is the card emoji on the News index; `from`/`to` pick
 *  the cover gradient. */
const POSTS = [
  {
    slug: 'glide-boost-reengineered',
    glyph: '🏃',
    from: '#0ea5e9',
    to: CAMPAIGN.blue,
    body: {
      title: 'Glide Boost: the daily trainer, reengineered',
      excerpt: 'A new energy-return midsole and a one-piece knit upper — here’s what changed, and why your easy miles will feel it.',
      body: doc(
        'The daily trainer is the hardest shoe to get right. It has to be soft enough for recovery runs and responsive enough for the days you pick up the pace — without falling apart at 400 miles.',
        'The new Glide Boost rebuilds the midsole from the ground up: a higher-rebound foam that returns more energy with every step, tuned to stay lively from the first mile to the finish.',
        'Up top, a one-piece engineered knit wraps the foot with zero break-in, and a wider base adds stability without adding weight. It’s the trainer we wanted to run in every day — so we made it.'
      ),
    },
  },
  {
    slug: 'inside-the-club',
    glyph: '🎟️',
    from: CAMPAIGN.green,
    to: '#052e16',
    body: {
      title: 'Inside the Club: what membership actually unlocks',
      excerpt: 'Free shipping, members-only drops, early access, and a birthday surprise — a quick tour of everything the Club gets you.',
      body: doc(
        'The Club is free, and it pays for itself the first time you check out. Members get free standard shipping on every order and free returns within 30 days — no minimums, no fine print.',
        'Beyond the basics, membership is about access: early entry to limited drops, members-only colorways, and points on every purchase that turn into rewards you’ll actually use.',
        'Join in under a minute, and we’ll throw in a welcome offer plus a little something on your birthday. It’s the easiest yes in your closet.'
      ),
    },
  },
  {
    slug: 'made-to-be-remade',
    glyph: '♻️',
    from: '#15803d',
    to: CAMPAIGN.teal,
    body: {
      title: 'Made to be remade: inside our recycled program',
      excerpt: 'How we’re building shoes from reclaimed materials — and designing them to come back when they’re worn out.',
      body: doc(
        'A shoe that ends its life in a landfill is a design failure. So we set a harder brief: build performance product from reclaimed materials, and make it easy to send back when the miles are done.',
        'Our recycled line uses uppers spun from reclaimed ocean-bound plastic and midsoles that can be ground down and remade. The goal isn’t a marketing badge — it’s a genuine loop.',
        'It’s early, and we’re not done. But every pair you send back becomes part of the next one, and that’s a future worth running toward.'
      ),
    },
  },
] as const;

/** Cover assets (one per post), spread into the manifest's `assets` alongside brand. */
export const newsCovers = POSTS.map((p) => ({
  id: `img-news-${p.slug}`,
  url: cover(p.from, p.to, p.glyph),
  alt: p.body.title,
}));

/** Post metadata for the News INDEX cards (pages/news.ts) — the single source of
 *  slug/title/excerpt/glyph shared with the seeded content, so the index never drifts.
 *  Each card links to `/blog/<slug>` (the article-detail route). */
export const newsPosts = POSTS.map((p) => ({
  slug: p.slug,
  title: p.body.title,
  excerpt: p.body.excerpt,
  glyph: p.glyph,
}));

export const content = POSTS.map((p) => ({
  typeKey: 'blog_post',
  slug: p.slug,
  status: 'draft' as const,
  body: {
    ...p.body,
    // `{ $asset }` resolves to the installed MediaAsset id, then validates as the image
    // field's media id (resolveAssetRefs → validateAndNormalizeBody).
    featuredImage: { $asset: `img-news-${p.slug}` },
  },
}));
