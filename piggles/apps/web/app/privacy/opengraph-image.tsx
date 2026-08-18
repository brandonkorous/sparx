import { OG_SIZE, renderOg } from '@piggles/brand/og';
import { MASCOT_POSES } from '@piggles/mascot';

export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'What information Piggles holds, and who else can touch it';

export default function Image() {
  return renderOg({
    title: 'Privacy',
    subtitle: 'What information Piggles holds, why, where it is stored, and who else can touch it.',
    pose: MASCOT_POSES.security,
  });
}
