import { renderModuleStoryCard } from '@/lib/og-module-stories';
import { MODULES } from '@/lib/modules';

// The Inventory module card — the story-card system (lib/og-story.tsx) with a
// food-and-drink vertical and the Inventory hue on "multiplied." See
// og-module-stories.
export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = MODULES.inventory.title;

export default function Image() {
  return renderModuleStoryCard('inventory');
}
