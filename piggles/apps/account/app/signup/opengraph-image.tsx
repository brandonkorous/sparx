import { OG_SIZE, renderOg } from '@piggles/brand/og';
import { PRODUCT } from '@piggles/config';
import { resolveIntent } from '@piggles/mascot';

export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'Create your Piggles account';

export default function Image() {
  return renderOg({
    title: 'Create your account',
    subtitle: 'Two questions, and a workspace that is already set up when you arrive.',
    footer: PRODUCT.hosts.account,
    pose: resolveIntent('welcome'),
  });
}
