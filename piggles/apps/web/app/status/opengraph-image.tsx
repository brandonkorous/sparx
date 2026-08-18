import { OG_SIZE, renderOg } from '@piggles/brand/og';
import { MASCOT_POSES } from '@piggles/mascot';

export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'Whether each part of Piggles is answering right now';

export default function Image() {
  return renderOg({
    title: 'Is Piggles answering?',
    subtitle:
      'Every part of the product, checked the moment you load the page. No uptime percentage, because we are not yet measuring one.',
    // Reading an instrument, not fixing a fault. `maintenance` would claim
    // something is broken before the page has checked.
    pose: MASCOT_POSES.analyst,
  });
}
