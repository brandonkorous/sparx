import { STORY_EXAMPLES } from '@sparx/story-schemas';
import { renderStoryOg } from '@/lib/og-story';

// The /customers page is about the RANGE of businesses on sparx, so its card tells
// a different story than the homepage's salon — the distributor, a B2B vertical —
// making the point ("every kind of operator") the way the page argues it. Same
// story-card system (lib/og-story.tsx), a different vertical.

export const runtime = 'nodejs';
export const alt = 'sparx — Your story, multiplied. Every kind of operator, one platform.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const DISTRIBUTOR = STORY_EXAMPLES.find((e) => e.label === 'a distributor');
if (!DISTRIBUTOR)
  throw new Error('STORY_EXAMPLES is missing the distributor — the /customers OG card needs it.');
const DISTRIBUTOR_STORY = DISTRIBUTOR.story;

export default function Image() {
  return renderStoryOg({
    story: DISTRIBUTOR_STORY,
    headline: { lead: 'Your story,', accent: 'multiplied.' },
    footerRight: 'sparx.works/customers',
  });
}
