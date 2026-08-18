import { OG_SIZE, renderOg } from '@piggles/brand/og';
import { PRODUCT } from '@piggles/config';
import { MASCOT_POSES } from '@piggles/mascot';

// The most-shared link this app has. An invitation gets forwarded, pasted into a
// group chat and screenshotted, by somebody who has never heard of Piggles — so
// of every card here this is the one doing the most work.
export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'You have been invited to help run a business on Piggles';

export default function Image() {
  return renderOg({
    title: 'You have been invited.',
    subtitle:
      'Somebody wants your help running their business. Take the invitation and you are in.',
    footer: PRODUCT.hosts.account,
    pose: MASCOT_POSES['meeting-table'],
  });
}
