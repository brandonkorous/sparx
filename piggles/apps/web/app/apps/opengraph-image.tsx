import { OG_SIZE, renderOg } from '@piggles/brand/og';
import { MASCOT_POSES } from '@piggles/mascot';

export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'All fifteen Piggles apps';

export default function Image() {
  return renderOg({
    title: 'Fifteen apps. One subscription.',
    subtitle: 'Grouped the way a business works, not the way a software catalogue is filed.',
    // Fifteen things, arranged — which is what she is doing, and what the page is.
    pose: MASCOT_POSES.organizer,
  });
}
