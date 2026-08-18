import { OG_SIZE, renderOg } from '@piggles/brand/og';
import { PRODUCT } from '@piggles/config';
import { MASCOT_POSES } from '@piggles/mascot';

export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'Choose a new Piggles password';

export default function Image() {
  return renderOg({
    title: 'Choose a new password',
    subtitle: 'One you have not used anywhere else, and nobody else has ever seen.',
    footer: PRODUCT.hosts.account,
    pose: MASCOT_POSES.security,
  });
}
