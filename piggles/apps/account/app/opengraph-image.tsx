import { OG_SIZE, renderOg } from '@piggles/brand/og';
import { PRODUCT } from '@piggles/config';
import { resolveIntent } from '@piggles/mascot';

// The account app's default card, and the one every page here falls back to.
//
// This app is `robots: noindex` — every page is behind a session or arrives from
// a specific link — which is exactly WHY it needs cards. Nothing here is found by
// searching; it is found because somebody was SENT it. An invitation pasted into
// a group chat, a sign-in link forwarded to a colleague, a consent screen opened
// from another product. A bare grey link at that moment is the first thing a
// person sees of Piggles, and it looks like nothing.
export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = PRODUCT.tagline;

export default function Image() {
  return renderOg({
    title: 'Your Piggles account',
    subtitle: 'Sign in, set your business up, and manage what you pay.',
    footer: PRODUCT.hosts.account,
    pose: resolveIntent('welcome'),
  });
}
