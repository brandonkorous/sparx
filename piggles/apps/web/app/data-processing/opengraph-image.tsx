import { OG_SIZE, renderOg } from '@piggles/brand/og';
import { MASCOT_POSES } from '@piggles/mascot';

export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'How WizeWorks handles personal data you hold on behalf of your customers';

export default function Image() {
  return renderOg({
    title: 'Data processing addendum',
    subtitle:
      'Roles, security, sub-processors, deletion, and what happens if something goes wrong.',
    pose: MASCOT_POSES['reports-desk'],
  });
}
