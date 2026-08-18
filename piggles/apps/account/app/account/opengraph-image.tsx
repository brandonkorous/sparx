import { OG_SIZE, renderOg } from '@piggles/brand/og';
import { PRODUCT } from '@piggles/config';
import { MASCOT_POSES } from '@piggles/mascot';

export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'Your Piggles account — what you pay and what you are using';

export default function Image() {
  return renderOg({
    title: 'Your account',
    subtitle: 'What you pay, what you are using, and the way back to work.',
    footer: PRODUCT.hosts.account,
    pose: MASCOT_POSES.organizer,
  });
}
