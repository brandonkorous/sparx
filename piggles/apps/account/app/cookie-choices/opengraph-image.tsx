import { OG_SIZE, renderOg } from '@piggles/brand/og';
import { PRODUCT } from '@piggles/config';
import { MASCOT_POSES } from '@piggles/mascot';

export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'Your Piggles cookie choices';

export default function Image() {
  return renderOg({
    title: 'Cookie choices',
    subtitle:
      'What Piggles is allowed to remember about your visit. Changed here, whenever you like.',
    footer: PRODUCT.hosts.account,
    pose: MASCOT_POSES.sidekick,
  });
}
