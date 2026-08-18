import { OG_SIZE, renderOg } from '@piggles/brand/og';
import { MASCOT_POSES } from '@piggles/mascot';

export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'How Piggles keeps your business data safe, separate and yours';

export default function Image() {
  return renderOg({
    title: 'The boring things, done properly.',
    subtitle: 'How your information is kept, who can reach it, and how you get it back.',
    pose: MASCOT_POSES.protector,
  });
}
