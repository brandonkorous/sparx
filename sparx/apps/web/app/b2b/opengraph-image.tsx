import { renderModuleStoryCard } from '@/lib/og-module-stories';
import { MODULES } from '@/lib/modules';

// The B2B module card — the story-card system (lib/og-story.tsx) with a
// distribution vertical and the B2B hue on "multiplied." See og-module-stories.
export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = MODULES.b2b.title;

export default function Image() {
  return renderModuleStoryCard('b2b');
}
