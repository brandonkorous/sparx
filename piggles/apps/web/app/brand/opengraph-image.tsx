import { OG_SIZE, renderOg } from '@piggles/brand/og';
import { MASCOT_POSES } from '@piggles/mascot';

export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'The Piggles brand — tokens, marks and the app-group palette';

export default function Image() {
  return renderOg({
    title: 'The Piggles brand.',
    subtitle:
      'Tokens, marks, the app-group palette, and the contrast every pairing actually measures.',
    pose: MASCOT_POSES['art-studio'],
  });
}
