import { OG_SIZE, renderOg } from '@piggles/brand/og';
import { resolveIntent } from '@piggles/mascot';

export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'How getting started with Piggles works';

export default function Image() {
  return renderOg({
    title: 'Two questions, then it is already set up.',
    subtitle:
      'What Piggles fills in for you, what your answer changes, and what the first fourteen days are.',
    pose: resolveIntent('onboarding'),
  });
}
