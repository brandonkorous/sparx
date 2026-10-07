import { OG_SIZE, renderOg } from '@piggles/brand/og';
import { resolveIntent } from '@piggles/mascot';

export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'You found Piggles';

export default function Image() {
  return renderOg({
    title: 'Business software for people who have a business to run.',
    subtitle: 'You found Piggles. Every app a small business needs, on one login.',
    pose: resolveIntent('onboarding'),
  });
}
