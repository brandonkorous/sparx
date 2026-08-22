import { OG_SIZE, renderOg } from '@piggles/brand/og';
import { PRODUCT } from '@piggles/config';
import { PRICE_LABEL } from '@piggles/config/pricing';
import { resolveIntent } from '@piggles/mascot';

// The default card — used by any page that does not supply its own.
export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = PRODUCT.tagline;

export default function Image() {
  return renderOg({
    title: `Everything your business runs on, for ${PRICE_LABEL} a month`,
    subtitle: 'Fifteen apps. One price. Named for what you are actually doing.',
    pose: resolveIntent('hero'),
  });
}
