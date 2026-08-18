import { OG_SIZE, renderOg } from '@piggles/brand/og';
import { MASCOT_POSES } from '@piggles/mascot';

export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'Seventeen free tools for small businesses, no sign-up';

export default function Image() {
  return renderOg({
    title: 'Seventeen free tools.',
    subtitle:
      'Invoices, QR codes, favicons, quotes, pricing sums and the SEO bits nobody explains. No sign-up, nothing uploaded.',
    pose: MASCOT_POSES.builder,
  });
}
