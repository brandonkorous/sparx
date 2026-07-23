import { renderModuleStoryCard } from '@/lib/og-module-stories';
import { MODULES } from '@/lib/modules';

// The Commerce module card — the story-card system (lib/og-story.tsx) with a
// selling vertical and the Commerce hue on "multiplied." See og-module-stories.
export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = MODULES.commerce.title;

export default function Image() {
  return renderModuleStoryCard('commerce');
}
