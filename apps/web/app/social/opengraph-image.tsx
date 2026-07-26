import { renderModuleStoryCard } from '@/lib/og-module-stories';
import { MODULES } from '@/lib/modules';

// The Social module card — the story-card system (lib/og-story.tsx) with an
// apparel brand growing its audience and the Social hue on "multiplied." See
// og-module-stories. Organic posting has no story clause of its own, so the card
// carries the module by hue + "Your reach, multiplied." headline.
export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = MODULES.social.title;

export default function Image() {
  return renderModuleStoryCard('social');
}
