// Forge generator — CMS content (three seeded "insight" articles) + their cover images.
// No node() calls here (CMS bodies are ProseMirror docs via `doc()`), so this evaluates
// before any tree is built. Each post carries a self-contained data-URI cover (a font-
// free "doc on a warm-black panel" with an accent block, echoing the studio palette)
// referenced by `{ $asset }`, so the `blog_post.featuredImage` binding in the story
// template resolves to a real image — the tenant swaps it post-install.

import { doc } from './_kit';

/** A font-free wide cover: a deep near-black panel with a floating "doc" card, an accent
 *  block, and cream skeleton lines. Stays well under the media_assets.key 1024-char cap. */
const cover = (accentHex: string): string => {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">` +
    `<rect width="1200" height="630" fill="#121009"/>` +
    `<rect x="360" y="150" width="480" height="330" rx="24" fill="#ECE7DD"/>` +
    `<rect x="404" y="196" width="150" height="26" rx="13" fill="${accentHex}"/>` +
    `<rect x="404" y="262" width="392" height="14" rx="7" fill="#15120D1f"/>` +
    `<rect x="404" y="296" width="352" height="14" rx="7" fill="#15120D14"/>` +
    `<rect x="404" y="330" width="300" height="14" rx="7" fill="#15120D14"/>` +
    `<rect x="404" y="392" width="120" height="34" rx="17" fill="#15120D"/>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

/** The seeded insight articles. `kicker` is the category label on the Insights index;
 *  `accent` picks the cover block + the card's top rule color. */
const STORIES = [
  {
    slug: 'brand-systems-that-scale',
    kicker: 'Brand',
    accent: '#C6F24E',
    body: {
      title: 'Designing brand systems that scale',
      excerpt: 'Why the best identities are systems, not logos — and how to build one that survives growth.',
      body: doc(
        'A logo is a single artifact; a brand system is the set of rules that lets a hundred artifacts feel like one company. The difference shows the moment a startup grows past its founders and a dozen people start making things in its name.',
        'We build identities as systems from day one: a flexible logo, a typographic scale, a colour architecture, motion principles, and a voice — each documented so a new hire or a new agency can extend the brand without diluting it.',
        'The payoff is compounding. Every touchpoint reinforces the last, recognition builds faster, and the brand becomes an asset that appreciates instead of a project that gets redone every two years.'
      ),
    },
  },
  {
    slug: 'websites-that-convert',
    kicker: 'Web',
    accent: '#5C97E8',
    body: {
      title: 'The anatomy of a website that converts',
      excerpt: 'Conversion isn’t a trick. It’s the compound result of clarity, speed, and a story told in the right order.',
      body: doc(
        'High-converting sites rarely win on a clever button colour. They win because the story is sequenced correctly: the visitor understands what you do, why it matters to them, and what to do next — in that order, without friction.',
        'Then there’s craft: sub-second loads, layouts that hold on every screen, motion that guides rather than distracts, and copy that says one clear thing per section. Each is small; together they move the number.',
        'We design and build for the metric, not the mock-up — instrumenting the funnel, testing the hypotheses that matter, and shipping a site that keeps earning after launch.'
      ),
    },
  },
  {
    slug: 'growth-is-engineered',
    kicker: 'Growth',
    accent: '#FF6A3D',
    body: {
      title: 'Growth is engineered, not hoped for',
      excerpt: 'A repeatable system for turning a launch into compounding pipeline — creative, SEO, lifecycle, CRO.',
      body: doc(
        'A great launch is a spike. Growth is what happens when you turn that spike into a system — performance creative that earns its spend, SEO that builds a durable moat, lifecycle that nurtures, and CRO that compounds every other channel.',
        'We treat growth like engineering: a backlog of hypotheses, a cadence of experiments, and a dashboard that tells the truth. What works gets scaled; what doesn’t gets cut without ceremony.',
        'The result isn’t a viral moment — it’s a machine. Predictable pipeline, a falling cost to acquire, and a brand that gets stronger every quarter instead of louder every campaign.'
      ),
    },
  },
] as const;

/** Cover assets (one per story), spread into the manifest's `assets` alongside brand. */
export const storyCovers = STORIES.map((s) => ({
  id: `img-insight-${s.slug}`,
  url: cover(s.accent),
  alt: s.body.title,
}));

/** Story metadata for the Insights INDEX cards (pages/insights.ts) — the single source
 *  of slug/title/excerpt/kicker shared with the seeded content, so the index never
 *  drifts. Each card links to `/blog/<slug>` (the story-detail route). */
export const insightStories = STORIES.map((s) => ({
  slug: s.slug,
  kicker: s.kicker,
  accent: s.accent,
  title: s.body.title,
  excerpt: s.body.excerpt,
}));

export const content = STORIES.map((s) => ({
  typeKey: 'blog_post',
  slug: s.slug,
  status: 'draft' as const,
  body: {
    ...s.body,
    // `{ $asset }` resolves to the installed MediaAsset id, then validates as the image
    // field's media id (resolveAssetRefs → validateAndNormalizeBody).
    featuredImage: { $asset: `img-insight-${s.slug}` },
  },
}));
