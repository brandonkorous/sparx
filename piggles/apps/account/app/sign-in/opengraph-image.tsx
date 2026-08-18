import { OG_SIZE, renderOg } from '@piggles/brand/og';
import { PRODUCT } from '@piggles/config';
import { resolveIntent } from '@piggles/mascot';

export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'Sign in to Piggles';

export default function Image() {
  return renderOg({
    title: 'Sign in to Piggles',
    subtitle: 'One door, for the account, the console and everything you run from them.',
    footer: PRODUCT.hosts.account,
    // The same pose that greets you on the panel beside the form — she looks up
    // from the desk rather than down at it, which is what a door should do.
    pose: resolveIntent('sign-in'),
  });
}
