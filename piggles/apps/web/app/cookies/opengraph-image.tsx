import { OG_SIZE, renderOg } from '@piggles/brand/og';
import { MASCOT_POSES } from '@piggles/mascot';

export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'Every cookie Piggles sets, what it is for and how long it lasts';

export default function Image() {
  return renderOg({
    title: 'Cookies',
    subtitle:
      'Every one Piggles sets, what it is for and how long it lasts. No advertising cookies, and nothing sold on.',
    pose: MASCOT_POSES.sidekick,
  });
}
