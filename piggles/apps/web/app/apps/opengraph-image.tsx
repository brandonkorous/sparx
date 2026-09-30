import { OG_SIZE, renderOg } from '@piggles/brand/og';
import { MASCOT_POSES } from '@piggles/mascot';
import { APP_COUNT_WORD, APP_COUNT_WORD_CAP } from '@piggles/config';

export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = `All ${APP_COUNT_WORD} Piggles apps`;

export default function Image() {
  return renderOg({
    title: `${APP_COUNT_WORD_CAP} apps. One subscription.`,
    subtitle: 'Grouped the way a business works, not the way a software catalog is filed.',
    // Fifteen things, arranged — which is what she is doing, and what the page is.
    pose: MASCOT_POSES.organizer,
  });
}
