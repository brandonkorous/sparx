import { OG_SIZE, renderOg } from '@piggles/brand/og';
import { PRODUCT } from '@piggles/config';
import { resolveIntent } from '@piggles/mascot';

export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'Set your business up on Piggles';

export default function Image() {
  return renderOg({
    title: 'Set your business up',
    subtitle: 'What you are called, and what you actually do. Everything else is already waiting.',
    footer: PRODUCT.hosts.account,
    pose: resolveIntent('onboarding'),
  });
}
