// Mosaic generator — CMS content (three seeded "customer story" posts) + their cover
// images. No node() calls here (CMS bodies are ProseMirror docs via `doc()`), so this
// evaluates before any tree is built. Each post carries a self-contained data-URI cover
// (a font-free "doc on a bento color" panel, echoing the home bento screenshots)
// referenced by `{ $asset }`, so the `blog_post.featuredImage` binding in the story
// template resolves to a real image — the tenant swaps it post-install.

import { doc } from './_kit';
import { BENTO } from './theme';

/** A font-free wide cover: a bento-colored panel with a floating white "doc" card and
 *  skeleton lines. Stays well under the media_assets.key 1024-char cap (~430 encoded). */
const cover = (bgHex: string): string => {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">` +
    `<rect width="1200" height="630" fill="${bgHex}"/>` +
    `<rect x="360" y="170" width="480" height="290" rx="24" fill="#ffffff" opacity="0.92"/>` +
    `<rect x="404" y="222" width="240" height="22" rx="11" fill="#0000001f"/>` +
    `<rect x="404" y="276" width="392" height="14" rx="7" fill="#00000014"/>` +
    `<rect x="404" y="308" width="352" height="14" rx="7" fill="#00000014"/>` +
    `<rect x="404" y="340" width="300" height="14" rx="7" fill="#00000014"/>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

/** The seeded customer stories. `glyph` is the card emoji on the Customers index; `bg`
 *  picks the cover color. */
const STORIES = [
  {
    slug: 'acme-ships-on-one-platform',
    glyph: '🚀',
    bg: BENTO.teal,
    body: {
      title: 'How Acme ships on a single platform',
      excerpt: 'Acme replaced four tools with one workspace — and cut launch timelines by 3x.',
      body: doc(
        'Acme’s product, design, and engineering teams used to live in four different tools. Specs in one place, tasks in another, docs scattered, and a chat tool tying nothing together.',
        'Moving to Mosaic gave every team one surface: docs, projects, and a knowledge base that agents and people both read from. Status is never more than a glance away.',
        'The result: a launch cadence that went from quarterly to monthly, and a single source of truth their whole org actually trusts.'
      ),
    },
  },
  {
    slug: 'northwind-one-source-of-truth',
    glyph: '📚',
    bg: BENTO.blue,
    body: {
      title: 'Northwind builds one source of truth',
      excerpt: 'A 600-person company finally gets answers without pinging a human.',
      body: doc(
        'As Northwind grew past 600 people, finding the right doc became a full-time job. Onboarding dragged, and the same questions got asked in every channel.',
        'With Mosaic’s knowledge base and enterprise search, every policy, runbook, and wiki page lives in one place — and a Q&A agent answers from it instantly.',
        'New hires ramp in days, not weeks, and the support team spends its time on hard problems instead of repeat questions.'
      ),
    },
  },
  {
    slug: 'lumen-agents-in-minutes',
    glyph: '⚡',
    bg: BENTO.coral,
    body: {
      title: 'Lumen automates the busywork with agents',
      excerpt: 'Custom Agents built in minutes now handle the work nobody wanted to.',
      body: doc(
        'Lumen’s ops team was drowning in repetitive work: triaging feedback, routing tickets, and stitching together weekly reports by hand.',
        'They built Custom Agents in an afternoon — a feedback triager, a ticket router, and a reporting agent — each grounded in the knowledge Lumen already had.',
        'Hours of manual work every week, gone. The team now spends its time on the projects that actually move the business.'
      ),
    },
  },
] as const;

/** Cover assets (one per story), spread into the manifest's `assets` alongside brand. */
export const storyCovers = STORIES.map((s) => ({
  id: `img-story-${s.slug}`,
  url: cover(s.bg),
  alt: s.body.title,
}));

/** Story metadata for the Customers INDEX cards (pages/customers.ts) — the single
 *  source of slug/title/excerpt/glyph shared with the seeded content, so the index
 *  never drifts. Each card links to `/blog/<slug>` (the story-detail route). */
export const customerStories = STORIES.map((s) => ({
  slug: s.slug,
  title: s.body.title,
  excerpt: s.body.excerpt,
  glyph: s.glyph,
}));

export const content = STORIES.map((s) => ({
  typeKey: 'blog_post',
  slug: s.slug,
  status: 'draft' as const,
  body: {
    ...s.body,
    // `{ $asset }` resolves to the installed MediaAsset id, then validates as the
    // image field's media id (resolveAssetRefs → validateAndNormalizeBody).
    featuredImage: { $asset: `img-story-${s.slug}` },
  },
}));
