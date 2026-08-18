import { OG_SIZE, renderOg } from '@piggles/brand/og';
import { PRODUCT } from '@piggles/config';
import { MASCOT_POSES } from '@piggles/mascot';

export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'Decide what an application may see in your Piggles business';

export default function Image() {
  return renderOg({
    title: 'What may this app see?',
    subtitle: 'Exactly what it is asking for, in plain words, before you allow any of it.',
    footer: PRODUCT.hosts.account,
    pose: MASCOT_POSES.protector,
  });
}
