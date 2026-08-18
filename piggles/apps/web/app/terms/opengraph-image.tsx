import { OG_SIZE, renderOg } from '@piggles/brand/og';
import { MASCOT_POSES } from '@piggles/mascot';

export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'The agreement between you and WizeWorks for using Piggles';

export default function Image() {
  return renderOg({
    title: 'Terms',
    subtitle:
      'What you get, what it costs, what you can and cannot do, and how either of us can end it.',
    pose: MASCOT_POSES.planner,
  });
}
