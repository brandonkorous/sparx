import { GROUP_HEX, BRAND } from '@piggles/brand';
import { OG_SIZE, renderOg } from '@piggles/brand/og';
import { APP_BY_ID, APPS } from '@piggles/config';
import { mascotForApp, resolveIntent } from '@piggles/mascot';
import { APP_MARKETING } from '@/content/apps';

// One card per app, wearing its GROUP hue and its own pose.
//
// The card a satellite domain produces when it is shared is the first thing
// anybody sees of Piggles, so it says the translation out loud: the headline is
// the plain-English name and the subtitle names the jargon it replaces. Somebody
// who pasted a link because they were researching "CRM software" sees "Customers"
// with "Most software calls this CRM" underneath — which is the entire pitch, in
// a preview card, before they have clicked anything.
//
// The pose comes from MASCOT_BY_APP, so the picture on the card is the SAME
// picture that greets you in that app's empty state. Fifteen decisions already
// made, once, with reasons — and a card that cannot drift from the product.

export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = 'image/png';

export function generateStaticParams() {
  return APPS.map((a) => ({ app: a.id }));
}

export default async function Image({ params }: { params: Promise<{ app: string }> }) {
  const { app: id } = await params;
  const app = APP_BY_ID[id];
  const copy = APP_MARKETING[id];

  // A missing id is a 404 on the page itself; the card just falls back to the
  // brand rather than throwing and rendering nothing at all.
  if (!app || !copy) {
    return renderOg({
      title: 'Piggles',
      subtitle: 'Business software for people who have a business to run.',
      pose: resolveIntent('hero'),
    });
  }

  // `home` has no entry in GROUP_HEX — its hue IS the brand pink, which differs
  // by theme and so is deliberately not duplicated into that map.
  const accent = app.group === 'home' ? BRAND.primary : GROUP_HEX[app.group];

  return renderOg({
    title: app.label,
    subtitle: `Most software calls this ${copy.alsoKnownAs[0]}. ${copy.heading}`,
    accent,
    pose: mascotForApp(id),
  });
}
