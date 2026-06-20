// Tempo generator — the blueprint's MARKETING email starters (the platform already ships
// the 19 keyed transactional defaults on email activation, so the blueprint never
// duplicates those). These are brand-voiced examples a tenant forks: a Club Welcome and a
// "new drops" broadcast. Both lead with the pinned `email_wordmark`; the broadcast carries
// the CAN-SPAM compliance footer (unsubscribe + physical address). Personalization uses the
// canonical merge tokens so a fork re-themes to the tenant.

import { node, type BuilderNode } from './_kit';

/** A small emoji-led perk/highlight line — a single Text node, email-safe. */
const perk = (text: string): BuilderNode => node('Text', { props: { variant: 'body', text } });

/** The marketing compliance footer (divider · unsubscribe · postal address). */
const complianceFooter = (): BuilderNode[] => [node('Divider'), node('unsubscribe_link'), node('physical_address')];

export function welcomeEmail(): BuilderNode {
  return node('Section', {
    box: { name: 'Email body', padding: 'none', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'md' },
    children: [
      node('email_wordmark', { props: { treatment: 'lockup', align: 'center', size: 'md' } }),
      node('Heading', { props: { level: 'h1', text: 'Welcome to the Club »' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: 'Hi {{customer.firstName ?? "there"}} — welcome to {{site.name}}. Your membership is live, and it pays for itself the first time you check out.',
        },
      }),
      node('Text', { props: { variant: 'body', text: 'Here’s what you just unlocked:' } }),
      perk('🚚  Free shipping on every order and free 30-day returns.'),
      perk('⚡  Early access to limited drops and members-only colorways.'),
      perk('🎁  Points on everything you buy, plus a birthday surprise.'),
      node('Button', { props: { label: 'Start shopping', href: '{{site.url}}' } }),
      node('Text', { props: { variant: 'meta', text: 'Built to move. Welcome to the team.' } }),
    ],
  });
}

export function dropsEmail(): BuilderNode {
  return node('Section', {
    box: { name: 'Email body', padding: 'none', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'md' },
    children: [
      node('email_wordmark', { props: { treatment: 'lockup', align: 'center', size: 'md' } }),
      node('Heading', { props: { level: 'h1', text: 'New drops just landed 🔥' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: 'Hi {{customer.firstName ?? "there"}} — fresh styles hit {{site.name}} this week. Move fast; the best sizes go first.',
        },
      }),
      perk('👟  Glide Boost — the daily trainer, reengineered.'),
      perk('⚽  Strike Pro TF — turf-ready, cage-tested.'),
      perk('🧥  Field Track Jacket — the original, back in the line.'),
      node('Button', { props: { label: 'Shop new arrivals', href: '{{site.url}}' } }),
      ...complianceFooter(),
    ],
  });
}
