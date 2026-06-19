// Farm Fresh generator — the blueprint's MARKETING email starters (the platform
// already ships the 19 keyed transactional defaults — order/shipping/dunning/etc. —
// on email activation, so the blueprint never duplicates those). These are brand-voiced
// examples a tenant forks: a newsletter-signup Welcome and a seasonal Broadcast. Both
// lead with the pinned `email_wordmark` header; the legal footer is renderer chrome.
// Personalization uses the canonical merge tokens (`{{customer.firstName ?? "there"}}`,
// `{{site.name}}`, `{{site.url}}`) so a fork re-themes to the tenant. Marketing emails
// carry the CAN-SPAM compliance footer (unsubscribe + physical address).

import { node, type BuilderNode } from './_kit';

/** A small emoji-led perk/highlight line — a single Text node, email-safe. */
const perk = (text: string): BuilderNode => node('Text', { props: { variant: 'body', text } });

/** The marketing compliance footer (divider · unsubscribe · postal address) — the
 *  same trio the platform's marketing defaults carry so the template passes the gate. */
const complianceFooter = (): BuilderNode[] => [
  node('Divider'),
  node('unsubscribe_link'),
  node('physical_address'),
];

export function welcomeEmail(): BuilderNode {
  return node('Section', {
    box: { name: 'Email body', padding: 'none', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'md' },
    children: [
      node('email_wordmark', { props: { treatment: 'lockup', align: 'center', size: 'md' } }),
      node('Heading', { props: { level: 'h1', text: 'Welcome to the table 🌱' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: 'Hi {{customer.firstName ?? "there"}} — thanks for joining {{site.name}}. You’re on the list for seasonal menus, new flavors, and the occasional treat.',
        },
      }),
      node('Text', { props: { variant: 'body', text: 'Here’s what to expect:' } }),
      perk('🥣  First look at new bowls and seasonal specials.'),
      perk('🌾  Stories from the farms we source within 60 miles.'),
      perk('🎁  Member-only offers and the occasional surprise.'),
      node('Button', { props: { label: 'See this week’s menu', href: '{{site.url}}' } }),
      node('Text', {
        props: { variant: 'meta', text: 'Here to deliver health — one bowl at a time.' },
      }),
    ],
  });
}

export function newsletterEmail(): BuilderNode {
  return node('Section', {
    box: { name: 'Email body', padding: 'none', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'md' },
    children: [
      node('email_wordmark', { props: { treatment: 'lockup', align: 'center', size: 'md' } }),
      node('Heading', { props: { level: 'h1', text: 'Fresh this week 🌿' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: 'Hi {{customer.firstName ?? "there"}} — the counter’s looking good. Here’s what’s in season at {{site.name}} and worth a trip.',
        },
      }),
      perk('🍓  Strawberry Fields is back — local berries over a creamy banana base.'),
      perk('🥗  Harvest Kale with roasted squash, quinoa and pomegranate.'),
      perk('🥤  Cold-pressed smoothies, blended to order and never from concentrate.'),
      node('Button', { props: { label: 'Order for pickup or delivery', href: '{{site.url}}' } }),
      ...complianceFooter(),
    ],
  });
}
