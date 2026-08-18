import { OG_SIZE, renderOg } from '@piggles/brand/og';
import { PRODUCT } from '@piggles/config';
import { resolveIntent } from '@piggles/mascot';

export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'Reset your Piggles password';

export default function Image() {
  return renderOg({
    title: 'Reset your password',
    subtitle: 'Tell us the address you signed up with and we will send you a way back in.',
    footer: PRODUCT.hosts.account,
    // A repair, so she is the one who helps rather than the one who celebrates.
    // The page itself drops its panel for the same reason: somebody locked out of
    // their own business does not want the product talking about itself.
    pose: resolveIntent('help'),
  });
}
