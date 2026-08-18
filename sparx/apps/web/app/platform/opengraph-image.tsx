import { STORY_EXAMPLES } from '@wizeworks/story-schemas';
import { renderStoryOg } from '@/lib/og-story';

// The /platform card tells the broadest shipped story — the local grocer, whose 7
// modules span content, commerce, B2B and dropship — so the "one platform for
// everything" pitch is shown, not asserted. Same story-card system as the
// homepage (lib/og-story.tsx), a different vertical: the motto, multiplied.

export const runtime = 'nodejs';
export const alt = 'sparx — Your story, multiplied. One platform for content and commerce.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const GROCER = STORY_EXAMPLES.find((e) => e.label === 'a local grocer');
if (!GROCER)
  throw new Error('STORY_EXAMPLES is missing the grocer — the /platform OG card needs it.');
const GROCER_STORY = GROCER.story;

export default function Image() {
  return renderStoryOg({
    story: GROCER_STORY,
    headline: { lead: 'Your story,', accent: 'multiplied.' },
    footerRight: 'sparx.works/platform',
  });
}
