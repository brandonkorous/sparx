// Farm Fresh Bowls generator — CMS content (the two seeded blog posts). Spread into
// the manifest's `content` array. No node() calls here (CMS bodies are ProseMirror
// docs via `doc()`), so this evaluates before any tree is built.

import { doc } from './_kit';

export const content = [
  {
    typeKey: 'blog_post',
    slug: 'sourcing-within-60-miles',
    status: 'draft' as const,
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
    typeKey: 'blog_post',
    slug: 'eating-with-the-seasons',
    status: 'draft' as const,
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
];
