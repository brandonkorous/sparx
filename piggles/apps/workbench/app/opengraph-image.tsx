import { OG_SIZE, renderOg } from '@piggles/brand/og';
import { PRODUCT } from '@piggles/config';
import { MASCOT_POSES } from '@piggles/mascot';

// ONE card for the whole console, and that is the right number.
//
// Every other route in this app is `[...path]` behind a session: a link to one is
// a link to a sign-in redirect for anybody who does not already have the keys, so
// per-page cards here would describe pages the person previewing them cannot open.
// What a shared mypiggles.com link should say is what this place IS.
export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = `${PRODUCT.name} — the console you run your business from`;

export default function Image() {
  return renderOg({
    title: 'Where the work happens',
    subtitle: 'Fifteen apps, one window, and whatever needs you first already on the screen.',
    footer: PRODUCT.hosts.console,
    // Head down, absorbed, mid-task. The console is the one surface that is not
    // greeting anybody — they are already here and already working.
    pose: MASCOT_POSES['laptop-focus'],
  });
}
